import { ANALYSIS_VERSION } from "../constants/analysis.js";
import { SNAPSHOT_READ_LEASE_MS } from "../constants/analysis.js";
import { randomUUID } from "node:crypto";
import { embeddingIdentity } from "../config/index.js";
import type {
  Analysis,
  Chunk,
  FileChunkSummary,
  Job,
  Repo,
} from "../models/index.js";
import { AppError } from "../utils/app-error.js";
import { Neo4jContext } from "./neo4j-context.js";

export class Neo4jIndexingRepository {
  constructor(private readonly db: Neo4jContext) {}

  async acquireSnapshotRead(repoId: string, snapshotId: string) {
    const id = randomUUID();

    const result = await this.db.transaction((tx) =>
      tx.run(
        `MATCH (r:Repository {id:$repoId})
         SET r.retentionLock=true REMOVE r.retentionLock
         WITH r
         MATCH (s:Snapshot {id:$snapshot,repoId:$repoId,status:'READY'})
         CREATE (lease:SnapshotReadLease {id:$id,snapshotId:$snapshot,expiresAt:$expiresAt})
         RETURN lease.id AS id`,
        {
          repoId,
          snapshot: snapshotId,
          id,
          expiresAt: Date.now() + SNAPSHOT_READ_LEASE_MS,
        },
      ),
    );
    if (!result.records.length)
      throw new AppError(
        "SNAPSHOT_NOT_READY",
        "Snapshot is no longer available.",
        409,
      );
    return id;
  }

  async releaseSnapshotRead(leaseId: string) {
    await this.db.query(
      "MATCH (lease:SnapshotReadLease {id:$id}) DETACH DELETE lease",
      { id: leaseId },
    );
  }

  async saveAnalysis(job: Job, analysis: Analysis) {
    // Initial deployment supports one indexing worker. Keep conservative headroom
    // under Aura Free quotas, including existing retained snapshots.
    const capacity = await this.db.capacity();

    const existing = await this.db.read(
      "MATCH (n) WHERE (n:Symbol OR n:CodeChunk) AND n.snapshotId=$snapshot RETURN count(n) AS total",
      { snapshot: job.snapshotId },
    );

    const additional =
      Math.max(
        0,
        analysis.symbols.length +
          analysis.chunks.length -
          Number(existing.records[0]?.get("total") ?? 0),
      ) + 1;
    if (
      capacity.nodes + additional > capacity.nodeLimit ||
      capacity.relationships + analysis.edges.length + analysis.chunks.length >
        capacity.relationshipLimit
    )
      throw new AppError(
        "GRAPH_CAPACITY",
        "Indexing would exceed the configured graph capacity. Delete older repositories or increase the database capacity.",
        413,
      );
    await this.db.transaction(async (tx) => {
      await this.db.owned(tx, job);
      await tx.run(
        "MERGE (s:Snapshot {id:$id}) ON CREATE SET s.createdAt=$createdAt SET s.repoId=$repoId, s.commit=$commit, s.status='BUILDING', s.embeddingIdentity=$identity, s.analysisVersion=$analysisVersion",
        {
          id: job.snapshotId,
          repoId: job.repoId,
          commit: job.commit,
          createdAt: Date.now(),
          identity: embeddingIdentity(this.db.config),
          analysisVersion: ANALYSIS_VERSION,
        },
      );
    });
    for (let i = 0; i < analysis.symbols.length; i += 200)
      await this.db.transaction(async (tx) => {
        await this.db.owned(tx, job);
        await tx.run(
          "UNWIND $rows AS row MERGE (n:Symbol {id:row.id}) SET n += row",
          { rows: analysis.symbols.slice(i, i + 200) },
        );
      });
    for (let i = 0; i < analysis.chunks.length; i += 100)
      await this.db.transaction(async (tx) => {
        await this.db.owned(tx, job);
        await tx.run(
          `UNWIND $rows AS row MERGE (n:CodeChunk {id:row.id}) SET n += row SET n:${this.db.embeddingLabel} WITH n,row MATCH (s:Symbol {id:row.symbolId}) MERGE (s)-[:HAS_CHUNK]->(n)`,
          { rows: analysis.chunks.slice(i, i + 100) },
        );
      });
    for (const kind of ["CALLS", "IMPORTS"] as const) {
      const edges = analysis.edges.filter((e) => e.kind === kind);
      for (let i = 0; i < edges.length; i += 200)
        await this.db.transaction(async (tx) => {
          await this.db.owned(tx, job);
          await tx.run(
            `UNWIND $rows AS row MATCH (a:Symbol {id:row.from}), (b:Symbol {id:row.to}) MERGE (a)-[e:${kind} {line:row.line}]->(b) SET e.path=row.path, e.resolution='resolved'`,
            { rows: edges.slice(i, i + 200) },
          );
        });
    }
  }

  async cachedEmbedding(contentHash: string) {
    const result = await this.db.read(
      "MATCH (c:CodeChunk {contentHash:$hash, embeddingModel:$model}) WHERE c.embedding IS NOT NULL RETURN c.embedding AS vector LIMIT 1",
      {
        hash: contentHash,
        model: embeddingIdentity(this.db.config),
      },
    );
    return result.records[0]?.get("vector") as number[] | undefined;
  }

  async saveEmbeddings(job: Job, chunks: Chunk[]) {
    await this.db.transaction(async (tx) => {
      await this.db.owned(tx, job);
      await tx.run(
        "UNWIND $rows AS row MATCH (c:CodeChunk {id:row.id, snapshotId:$snapshot}) SET c.embedding=row.embedding, c.embeddingModel=$model",
        {
          rows: chunks.map((c) => ({ id: c.id, embedding: c.embedding })),
          snapshot: job.snapshotId,
          model: embeddingIdentity(this.db.config),
        },
      );
    });
  }

  async activate(job: Job) {
    await this.db.transaction(async (tx) => {
      await this.db.owned(tx, job);
      const result = await tx.run(
        "MATCH (c:CodeChunk {snapshotId:$id}) RETURN count(c) AS total, count(c.embedding) AS embedded",
        { id: job.snapshotId },
      );
      if (
        Number(result.records[0]?.get("total")) !== job.chunks ||
        Number(result.records[0]?.get("embedded")) !== job.chunks
      )
        throw new AppError(
          "INCOMPLETE_SNAPSHOT",
          "Snapshot is incomplete.",
          503,
        );
      const activated = await tx.run(
        "MATCH (r:Repository {id:$repo}), (s:Snapshot {id:$snapshot}), (j:IndexJob {id:$job}) WHERE r.deletedAt IS NULL SET r.activeSnapshot=$snapshot, r.commit=$commit, s.status='READY', j.status='READY', j.updatedAt=$now RETURN r",
        {
          repo: job.repoId,
          snapshot: job.snapshotId,
          job: job.id,
          commit: job.commit,
          now: Date.now(),
        },
      );
      if (!activated.records.length)
        throw new AppError(
          "REPOSITORY_DELETING",
          "Repository no longer available.",
          409,
        );
    });
  }

  async snapshotReady(repo: Repo, snapshot: string) {
    return (
      (
        await this.db.read(
          "MATCH (s:Snapshot {id:$snapshot,repoId:$repo,status:'READY',embeddingIdentity:$identity,analysisVersion:$analysisVersion}) RETURN s.id",
          {
            snapshot,
            repo: repo.id,
            identity: embeddingIdentity(this.db.config),
            analysisVersion: ANALYSIS_VERSION,
          },
        )
      ).records.length > 0
    );
  }

  async getSnapshotCommit(repo: string, snapshot: string) {
    const row = (
      await this.db.read(
        "MATCH (s:Snapshot {id:$snapshot,repoId:$repo,status:'READY'}) RETURN s.commit AS commit",
        { repo, snapshot },
      )
    ).records[0];
    if (!row)
      throw new AppError(
        "SNAPSHOT_NOT_READY",
        "Snapshot no longer available.",
        409,
      );
    return String(row.get("commit"));
  }

  async chunkSummary(snapshot: string): Promise<FileChunkSummary[]> {
    const result = await this.db.read(
      "MATCH (c:CodeChunk {snapshotId:$snapshot}) WITH c.path AS path,count(c) AS chunks,count(c.embedding) AS embeddedChunks RETURN path,chunks,embeddedChunks ORDER BY path",
      { snapshot },
    );
    return result.records.map((record) => ({
      path: String(record.get("path")),
      chunks: Number(record.get("chunks")),
      embeddedChunks: Number(record.get("embeddedChunks")),
    }));
  }

  async pruneInactiveSnapshots(cutoff: number, batchSize = 500) {
    const candidates = await this.db.read(
      `MATCH (s:Snapshot)
       WHERE s.createdAt < $cutoff
         AND s.status IN ['READY','BUILDING']
         AND NOT EXISTS { MATCH (r:Repository {activeSnapshot:s.id}) }
         AND NOT EXISTS {
           MATCH (j:IndexJob {snapshotId:s.id})
           WHERE NOT j.status IN ['READY','FAILED','CANCELLED']
         }
         AND NOT EXISTS {
           MATCH (lease:SnapshotReadLease {snapshotId:s.id})
           WHERE lease.expiresAt > $now
         }
       RETURN s.id AS id, s.repoId AS repoId
       ORDER BY s.createdAt
       LIMIT $limit`,
      { cutoff, now: Date.now(), limit: batchSize },
    );
    await this.db.query(
      "MATCH (lease:SnapshotReadLease) WHERE lease.expiresAt <= $now WITH lease LIMIT $limit DETACH DELETE lease",
      { now: Date.now(), limit: batchSize },
    );
    let deleted = 0;
    for (const record of candidates.records) {
      const snapshot = String(record.get("id"));

      const repoId = String(record.get("repoId"));
      let stillEligible = true;
      for (const label of ["Symbol", "CodeChunk"] as const) {
        while (stillEligible) {
          const result = await this.db.transaction(async (tx) => {
            const batch = await tx.run(
              `MATCH (r:Repository {id:$repoId})
               SET r.retentionLock=true REMOVE r.retentionLock
               WITH r
               MATCH (s:Snapshot {id:$snapshot,repoId:$repoId})
               WHERE s.createdAt < $cutoff
                 AND s.status IN ['READY','BUILDING']
                 AND coalesce(r.activeSnapshot,'') <> s.id
                 AND NOT EXISTS {
                   MATCH (j:IndexJob {snapshotId:s.id})
                   WHERE NOT j.status IN ['READY','FAILED','CANCELLED']
                 }
                 AND NOT EXISTS {
                   MATCH (lease:SnapshotReadLease {snapshotId:s.id})
                   WHERE lease.expiresAt > $now
                 }
               OPTIONAL MATCH (n:${label} {snapshotId:s.id})
               WITH n LIMIT $batchSize
               DETACH DELETE n
               RETURN count(n) AS removed`,
              { repoId, snapshot, cutoff, now: Date.now(), batchSize },
            );
            if (!batch.records.length) return undefined;
            return Number(batch.records[0]?.get("removed") ?? 0);
          });
          if (result === undefined) {
            stillEligible = false;
            break;
          }
          if (result === 0) break;
        }
      }
      if (stillEligible) {
        const removedSnapshot = await this.db.transaction(async (tx) => {
          const eligible = await tx.run(
            `MATCH (r:Repository {id:$repoId})
             SET r.retentionLock=true REMOVE r.retentionLock
             WITH r
             MATCH (s:Snapshot {id:$snapshot,repoId:$repoId})
             WHERE s.createdAt < $cutoff
               AND s.status IN ['READY','BUILDING']
               AND coalesce(r.activeSnapshot,'') <> s.id
               AND NOT EXISTS {
                 MATCH (j:IndexJob {snapshotId:s.id})
                 WHERE NOT j.status IN ['READY','FAILED','CANCELLED']
               }
               AND NOT EXISTS {
                 MATCH (lease:SnapshotReadLease {snapshotId:s.id})
                 WHERE lease.expiresAt > $now
               }
               AND NOT EXISTS { MATCH (n:Symbol {snapshotId:s.id}) }
               AND NOT EXISTS { MATCH (n:CodeChunk {snapshotId:s.id}) }
             WITH s
             OPTIONAL MATCH (q:QueryRun {repoId:$repoId,snapshotId:$snapshot})
             WITH s, collect(q) AS runs
             FOREACH (run IN runs | DELETE run)
             DETACH DELETE s
             RETURN count(s) AS deleted`,
            { repoId, snapshot, cutoff, now: Date.now() },
          );
          return Number(eligible.records[0]?.get("deleted") ?? 0);
        });
        deleted += removedSnapshot;
      }
    }
    return deleted;
  }
}
