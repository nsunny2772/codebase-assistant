import { describe, it, expect } from "vitest";
import { createNeo4jDriver } from "../src/connection/neo4j.connection.js";
import { Neo4jStore } from "../src/repositories/neo4j.repository.js";
import { parseConfig } from "../src/config/index.js";
import { parseRepository } from "../src/validations/repository.validation.js";
import { analyze } from "../src/services/analysis/parser.js";

// This suite must point to a disposable database, never a production database.
describe.skipIf(!process.env.TEST_NEO4J_URI)(
  "real Neo4j persistence and search",
  () => {
    it("tests job contention, lease fencing, graph storage, scoped search and deletion", async () => {
      const config = parseConfig({
        NEO4J_URI: process.env.TEST_NEO4J_URI,
        NEO4J_PASSWORD: process.env.TEST_NEO4J_PASSWORD,
        NEO4J_USERNAME: process.env.TEST_NEO4J_USERNAME ?? "neo4j",
        NEO4J_DATABASE: process.env.TEST_NEO4J_DATABASE ?? "neo4j",
        EMBEDDING_PROVIDER: "voyage",
      });

      const driver = createNeo4jDriver(config);

      const store = new Neo4jStore(driver, config);

      const repo = parseRepository(
        `https://github.com/test/fixture-${Date.now()}`,
      );
      try {
        await store.init();
        await store.heartbeat("integration-worker");
        expect(await store.operationalReadiness()).toMatchObject({
          migrationsReady: true,
          workerReady: true,
        });
        const submitted = await Promise.all([
          store.enqueue(repo),
          store.enqueue(repo),
        ]);
        expect(submitted[0]?.job.id).toBe(submitted[1]?.job.id);
        const claimed = await Promise.all([
          store.claim("one"),
          store.claim("two"),
        ]);

        const jobs = claimed.filter((j) => j?.id === submitted[0]?.job.id);
        expect(jobs).toHaveLength(1);
        const job = jobs[0]!;
        await expect(
          store.update({ ...job, attempt: job.attempt - 1 }, { files: 10 }),
        ).rejects.toThrow("ownership");
        await store.update(job, {
          snapshotId: job.id,
          commit: "a".repeat(40),
          status: "PARSING",
        });
        const analysis = analyze(
          [
            {
              path: "auth.ts",
              text: "export function authentication() { return true; }",
            },
          ],
          job.snapshotId,
        );

        const limitedConfig = { ...config, GRAPH_NODE_LIMIT: 1 };

        const limitedStore = new Neo4jStore(
          createNeo4jDriver(limitedConfig),
          limitedConfig,
        );
        try {
          await expect(
            limitedStore.saveAnalysis(job, analysis),
          ).rejects.toThrow("graph capacity");
        } finally {
          await limitedStore.close();
        }
        await store.saveAnalysis(job, analysis);
        for (const chunk of analysis.chunks)
          chunk.embedding = Array.from({ length: 1024 }, (_, i) =>
            i === 0 ? 1 : 0,
          );
        await store.saveEmbeddings(job, analysis.chunks);
        await store.update(job, {
          chunks: analysis.chunks.length,
          status: "VERIFYING",
        });
        await store.activate(job);
        expect((await store.getRepo(repo.id))?.activeSnapshot).toBe(
          job.snapshotId,
        );
        await driver.executeQuery(
          `CREATE (:Snapshot {id:$inactive,repoId:$repo,status:'READY',createdAt:1})
           CREATE (:CodeChunk {id:$inactiveChunk,snapshotId:$inactive})
           CREATE (:QueryRun {id:$oldRun,repoId:$repo,snapshotId:$inactive})
           CREATE (:Snapshot {id:$building,repoId:$repo,status:'BUILDING',createdAt:1})
           CREATE (:IndexJob {id:$activeJob,repoId:$repo,snapshotId:$building,status:'EMBEDDING'})
           CREATE (:Snapshot {id:$leased,repoId:$repo,status:'READY',createdAt:1})
           CREATE (:CodeChunk {id:$leasedChunk,snapshotId:$leased})
           CREATE (:SnapshotReadLease {id:$lease, snapshotId:$leased, expiresAt:$expiry})`,
          {
            repo: repo.id,
            inactive: `${job.id}-inactive`,
            inactiveChunk: `${job.id}-inactive-chunk`,
            oldRun: `${job.id}-old-run`,
            building: `${job.id}-building`,
            activeJob: `${job.id}-active-job`,
            leased: `${job.id}-leased`,
            leasedChunk: `${job.id}-leased-chunk`,
            lease: `${job.id}-lease`,
            expiry: Date.now() + 60000,
          },
          { database: config.NEO4J_DATABASE },
        );
        expect(await store.pruneInactiveSnapshots(Date.now(), 10)).toBe(1);
        const retained = await driver.executeQuery(
          "MATCH (s:Snapshot) WHERE s.id IN $ids RETURN collect(s.id) AS ids",
          {
            ids: [
              job.snapshotId,
              `${job.id}-inactive`,
              `${job.id}-building`,
              `${job.id}-leased`,
            ],
          },
          { database: config.NEO4J_DATABASE },
        );
        expect(new Set(retained.records[0]?.get("ids"))).toEqual(
          new Set([job.snapshotId, `${job.id}-building`, `${job.id}-leased`]),
        );
        const leaseResult = await store.pruneInactiveSnapshots(Date.now(), 10);
        expect(leaseResult).toBe(0);
        await store.releaseSnapshotRead(`${job.id}-lease`);
        expect(await store.pruneInactiveSnapshots(Date.now(), 10)).toBe(1);
        let results = await store.search(
          job.snapshotId,
          "authentication",
          Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)),
        );
        for (let i = 0; !results.length && i < 10; i++) {
          await new Promise((r) => setTimeout(r, 300));
          results = await store.search(
            job.snapshotId,
            "authentication",
            Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)),
          );
        }
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((c) => c.snapshotId === job.snapshotId)).toBe(
          true,
        );
        expect(
          await store.search(
            "unrelated-snapshot",
            "authentication",
            Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)),
          ),
        ).toEqual([]);
        await store.deleteRepo(repo.id);
        await store.retireWorker("integration-worker");
        expect((await store.operationalReadiness()).workerReady).toBe(false);
        expect(await store.getRepo(repo.id)).toBeUndefined();
        expect(await store.getJob(job.id)).toBeUndefined();
      } finally {
        await store.deleteRepo(repo.id);
        await store.close();
      }
    }, 60000);
  },
);
