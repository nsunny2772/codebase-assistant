import { randomUUID } from "node:crypto";
import type { Job, Repo } from "../models/index.js";
import { AppError } from "../utils/app-error.js";
import { jobFrom, repoFrom } from "./neo4j-mapping.js";
import { Neo4jContext } from "./neo4j-context.js";

export class Neo4jJobsRepository {
  constructor(private readonly db: Neo4jContext) {}

  async listRepos() {
    return (
      await this.db.read(
        "MATCH (r:Repository) WHERE r.deletedAt IS NULL RETURN r ORDER BY r.createdAt DESC LIMIT 100",
      )
    ).records.map((r) => repoFrom(r.get("r").properties));
  }

  async getRepo(id: string) {
    const record = (
      await this.db.read(
        "MATCH (r:Repository {id:$id}) WHERE r.deletedAt IS NULL RETURN r",
        { id },
      )
    ).records[0]?.get("r").properties as Record<string, unknown> | undefined;
    return record ? repoFrom(record) : undefined;
  }

  async enqueue(input: Pick<Repo, "id" | "url" | "owner" | "name">) {
    return this.db.transaction(async (tx) => {
      const now = Date.now();
      // Serialize submissions to enforce the pilot queue bound, even across API replicas.
      await tx.run(
        "MERGE (q:Budget {id:'queue_lock'}) SET q.lock=coalesce(q.lock,0)+1",
      );
      const existing = await tx.run(
        "MATCH (j:IndexJob {repoId:$repoId}) WHERE NOT j.status IN ['READY','FAILED','CANCELLED'] RETURN j LIMIT 1",
        { repoId: input.id },
      );

      const r = await tx.run(
        "MERGE (r:Repository {id:$id}) ON CREATE SET r += $props RETURN r",
        {
          id: input.id,
          props: { ...input, activeSnapshot: "", commit: "", createdAt: now },
        },
      );

      const repo = repoFrom(r.records[0]!.get("r").properties);
      if (repo.deletedAt)
        throw new AppError(
          "REPOSITORY_DELETING",
          "Repository deletion is in progress.",
          409,
        );
      if (existing.records[0])
        return { repo, job: jobFrom(existing.records[0].get("j").properties) };
      const active = await tx.run(
        "MATCH (j:IndexJob) WHERE NOT j.status IN ['READY','FAILED','CANCELLED'] RETURN count(j) AS total",
      );
      if (
        Number(active.records[0]?.get("total")) >=
        this.db.config.MAX_ACTIVE_JOBS
      )
        throw new AppError(
          "QUEUE_FULL",
          "Indexing queue is full. Try again later.",
          429,
          true,
        );
      const job: Job = {
        id: randomUUID(),
        repoId: repo.id,
        status: "QUEUED",
        commit: "",
        snapshotId: "",
        files: 0,
        chunks: 0,
        completedChunks: 0,
        warnings: [],
        error: "",
        createdAt: now,
        updatedAt: now,
        attempt: 0,
        leaseOwner: "",
        leaseUntil: 0,
        nextAttemptAt: 0,
      };
      await tx.run("CREATE (j:IndexJob) SET j=$job", { job });
      return { repo, job };
    });
  }

  async getJob(id: string) {
    const r = (
      await this.db.read("MATCH (j:IndexJob {id:$id}) RETURN j", { id })
    ).records[0];
    return r ? jobFrom(r.get("j").properties) : undefined;
  }

  async listJobs(repoId: string) {
    return (
      await this.db.read(
        "MATCH (j:IndexJob {repoId:$repoId}) RETURN j ORDER BY j.createdAt DESC LIMIT 10",
        { repoId },
      )
    ).records.map((r) => jobFrom(r.get("j").properties));
  }

  async claim(worker: string, repoId?: string) {
    return this.db.transaction(async (tx) => {
      await tx.run(
        "MERGE (q:Budget {id:'queue_lock'}) SET q.lock=coalesce(q.lock,0)+1",
      );
      const result = await tx.run(
        "MATCH (j:IndexJob) WHERE ($repoId IS NULL OR j.repoId=$repoId) AND ((j.status='QUEUED' AND coalesce(j.nextAttemptAt,0) <= $now) OR (NOT j.status IN ['READY','FAILED','CANCELLED','QUEUED'] AND j.leaseUntil < $now)) RETURN j ORDER BY j.createdAt LIMIT 1",
        { now: Date.now(), repoId: repoId ?? null },
      );
      if (!result.records[0]) return undefined;
      const job = jobFrom(result.records[0].get("j").properties);
      if (job.attempt >= this.db.config.INDEX_MAX_ATTEMPTS) {
        await tx.run(
          "MATCH (j:IndexJob {id:$id}) SET j.status='FAILED', j.error='RETRY_EXHAUSTED', j.updatedAt=$now",
          { id: job.id, now: Date.now() },
        );
        return undefined;
      }
      job.leaseOwner = worker;
      job.leaseUntil = Date.now() + 60000;
      job.attempt++;
      job.status = "FETCHING";
      job.updatedAt = Date.now();
      job.nextAttemptAt = 0;
      job.error = "";
      await tx.run("MATCH (j:IndexJob {id:$id}) SET j=$job", {
        id: job.id,
        job,
      });
      return job;
    });
  }

  async update(job: Job, patch: Partial<Job>) {
    await this.db.transaction(async (tx) => {
      await this.db.owned(tx, job);
      await tx.run("MATCH (j:IndexJob {id:$id}) SET j += $patch", {
        id: job.id,
        patch: {
          ...patch,
          updatedAt: Date.now(),
          leaseUntil: Date.now() + 60000,
        },
      });
    });
    Object.assign(job, patch);
  }

  async cancel(id: string) {
    await this.db.query(
      "MATCH (j:IndexJob {id:$id}) WHERE NOT j.status IN ['READY','FAILED','CANCELLED'] SET j.status='CANCELLED', j.updatedAt=$now",
      { id, now: Date.now() },
    );
  }

  async deleteRepo(id: string) {
    await this.db.query(
      "MATCH (r:Repository {id:$id}) SET r.deletedAt=$now WITH r OPTIONAL MATCH (j:IndexJob {repoId:$id}) SET j.status='CANCELLED'",
      { id, now: Date.now() },
    );
    // Keep the tombstone until every scoped record has been removed. Retry is safe.
    for (const label of ["Symbol", "CodeChunk"]) {
      let remaining = true;
      while (remaining) {
        const result = await this.db.query(
          `MATCH (s:Snapshot {repoId:$id}) WITH collect(s.id) AS ids MATCH (n:${label}) WHERE n.snapshotId IN ids WITH n LIMIT 500 DETACH DELETE n RETURN count(*) AS removed`,
          { id },
        );
        remaining = Number(result.records[0]?.get("removed") ?? 0) > 0;
      }
    }
    await this.db.query(
      "MATCH (n) WHERE (n:Snapshot OR n:IndexJob OR n:QueryRun) AND n.repoId=$id DETACH DELETE n",
      { id },
    );
    await this.db.query("MATCH (r:Repository {id:$id}) DETACH DELETE r", {
      id,
    });
  }
}
