import { randomUUID } from "node:crypto";
import type { Store } from "../src/repositories/store.js";
import {
  type Repo,
  type Job,
  type Analysis,
  type Chunk,
  type Answer,
  type Evidence,
} from "../src/models/index.js";
import { AppError } from "../src/utils/app-error.js";

// Test double only. Production always uses Neo4jStore.
export class MemoryStore implements Store {
  repos = new Map<string, Repo>();

  jobs = new Map<string, Job>();

  analyses = new Map<string, Analysis>();

  ready = new Map<string, { repo: string; commit: string }>();

  readLeases = new Set<string>();

  answers: {
    repo: string;
    conversation: string;
    question: string;
    answer: Answer;
  }[] = [];

  async init() {}

  async heartbeat() {}

  async retireWorker() {}

  async operationalReadiness() {
    return { migrationsReady: true, workerReady: true };
  }

  async pruneInactiveSnapshots() {
    return 0;
  }

  async acquireSnapshotRead(_repoId: string, snapshotId: string) {
    this.readLeases.add(snapshotId);
    return snapshotId;
  }

  async releaseSnapshotRead(leaseId: string) {
    this.readLeases.delete(leaseId);
  }

  async close() {}

  async listRepos() {
    return [...this.repos.values()];
  }

  async getRepo(id: string) {
    return this.repos.get(id);
  }

  async enqueue(input: Pick<Repo, "id" | "url" | "owner" | "name">) {
    let repo = this.repos.get(input.id);
    if (!repo) {
      repo = {
        ...input,
        activeSnapshot: "",
        commit: "",
        createdAt: Date.now(),
      };
      this.repos.set(input.id, repo);
    }
    const old = [...this.jobs.values()].find(
      (j) =>
        j.repoId === repo.id &&
        !["READY", "FAILED", "CANCELLED"].includes(j.status),
    );
    if (old) return { repo, job: old };
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempt: 0,
      leaseOwner: "",
      leaseUntil: 0,
      nextAttemptAt: 0,
    };
    this.jobs.set(job.id, job);
    return { repo, job };
  }

  async getJob(id: string) {
    return this.jobs.get(id);
  }

  async listJobs(repoId: string) {
    return [...this.jobs.values()]
      .filter((j) => j.repoId === repoId)
      .reverse()
      .slice(0, 10);
  }

  async capacity() {
    return {
      nodes: 0,
      relationships: 0,
      nodeLimit: 180000,
      relationshipLimit: 360000,
      measurementsMs: { nodes: 0, relationships: 0 },
    };
  }

  async claim(worker: string) {
    const job = [...this.jobs.values()].find(
      (j) => j.status === "QUEUED" && j.nextAttemptAt <= Date.now(),
    );
    if (job) {
      job.leaseOwner = worker;
      job.attempt++;
      job.leaseUntil = Date.now() + 60000;
      job.nextAttemptAt = 0;
      job.error = "";
      job.status = "FETCHING";
    }
    return job;
  }

  private owned(job: Job) {
    const stored = this.jobs.get(job.id);
    if (
      !stored ||
      stored.leaseOwner !== job.leaseOwner ||
      stored.attempt !== job.attempt ||
      stored.status === "CANCELLED" ||
      stored.leaseUntil < Date.now()
    )
      throw new AppError("LEASE_LOST", "Lost lease", 409);
  }

  async update(job: Job, patch: Partial<Job>) {
    this.owned(job);
    Object.assign(job, patch);
  }

  async saveAnalysis(job: Job, analysis: Analysis) {
    this.owned(job);
    this.analyses.set(job.snapshotId, analysis);
  }

  async cachedEmbedding(hash: string) {
    return [...this.analyses.values()]
      .flatMap((a) => a.chunks)
      .find((c) => c.contentHash === hash && c.embedding)?.embedding;
  }

  async saveEmbeddings(job: Job, chunks: Chunk[]) {
    this.owned(job);
    for (const chunk of chunks) {
      const old = this.analyses
        .get(job.snapshotId)
        ?.chunks.find((c) => c.id === chunk.id);
      if (old) old.embedding = chunk.embedding;
    }
  }

  async activate(job: Job) {
    this.owned(job);
    const repo = this.repos.get(job.repoId)!;
    if (this.analyses.get(job.snapshotId)?.chunks.some((c) => !c.embedding))
      throw new Error("Incomplete snapshot");
    repo.activeSnapshot = job.snapshotId;
    repo.commit = job.commit;
    this.ready.set(job.snapshotId, { repo: repo.id, commit: job.commit });
    job.status = "READY";
  }

  async cancel(id: string) {
    const j = this.jobs.get(id);
    if (j) j.status = "CANCELLED";
  }

  async deleteRepo(id: string) {
    for (const [sid, s] of this.ready)
      if (s.repo === id) {
        this.ready.delete(sid);
        this.analyses.delete(sid);
      }
    for (const [jid, j] of this.jobs)
      if (j.repoId === id) this.jobs.delete(jid);
    this.answers = this.answers.filter((a) => a.repo !== id);
    this.repos.delete(id);
  }

  async snapshotReady(repo: Repo, snapshot: string) {
    return this.ready.get(snapshot)?.repo === repo.id;
  }

  async getSnapshotCommit(repo: string, snapshot: string) {
    const s = this.ready.get(snapshot);
    if (s?.repo !== repo)
      throw new AppError("NOT_FOUND", "Snapshot missing", 404);
    return s.commit;
  }

  async chunkSummary(snapshot: string) {
    const chunks = this.analyses.get(snapshot)?.chunks ?? [];

    const byPath = new Map<
      string,
      { chunks: number; embeddedChunks: number }
    >();
    for (const chunk of chunks) {
      const summary = byPath.get(chunk.path) ?? {
        chunks: 0,
        embeddedChunks: 0,
      };
      summary.chunks++;
      if (chunk.embedding) summary.embeddedChunks++;
      byPath.set(chunk.path, summary);
    }
    return [...byPath].map(([path, summary]) => ({ path, ...summary }));
  }

  async search(
    snapshot: string,
    query: string,
    _vector?: number[],
  ): Promise<Evidence[]> {
    void _vector;
    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2);
    return (this.analyses.get(snapshot)?.chunks ?? [])
      .map((c) => ({
        ...c,
        score: terms.filter((t) =>
          `${c.name} ${c.path} ${c.text}`.toLowerCase().includes(t),
        ).length,
      }))
      .filter((c) => c.score > 0);
  }

  async neighbors(snapshot: string, ids: string[]): Promise<Evidence[]> {
    const a = this.analyses.get(snapshot);
    if (!a) return [];
    const symbols = a.chunks
      .filter((c) => ids.includes(c.id))
      .map((c) => c.symbolId);

    const next = a.edges
      .filter((e) => symbols.includes(e.from) || symbols.includes(e.to))
      .flatMap((e) => [e.from, e.to]);
    return a.chunks
      .filter((c) => next.includes(c.symbolId))
      .map((c) => ({ ...c, score: 0.1 }));
  }

  async symbols(snapshot: string, name: string) {
    return (
      this.analyses
        .get(snapshot)
        ?.symbols.filter((s) => s.name.includes(name)) ?? []
    );
  }

  async history(repo: string, snapshot: string, conversation: string) {
    return this.answers
      .filter(
        (a) =>
          a.repo === repo &&
          a.answer.snapshotId === snapshot &&
          a.conversation === conversation,
      )
      .slice(-3)
      .map((a) => ({ question: a.question, answer: a.answer.answer }));
  }

  async recordAnswer(
    repo: string,
    conversation: string,
    question: string,
    answer: Answer,
  ) {
    this.answers.push({ repo, conversation, question, answer });
  }

  async reserve(_kind: "embedding" | "answer", _tokens: number) {
    void _kind;
    void _tokens;
  }
}
