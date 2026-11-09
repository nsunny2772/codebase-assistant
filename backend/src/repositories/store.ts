import type {
  Analysis,
  Answer,
  Chunk,
  Evidence,
  FileChunkSummary,
  Job,
  Repo,
} from "../models/index.js";

export interface Store {
  init(): Promise<void>;
  heartbeat(workerId: string): Promise<void>;
  retireWorker(workerId: string): Promise<void>;
  operationalReadiness(): Promise<{
    migrationsReady: boolean;
    workerReady: boolean;
    lastWorkerHeartbeat?: number;
  }>;
  acquireSnapshotRead(repoId: string, snapshotId: string): Promise<string>;
  releaseSnapshotRead(leaseId: string): Promise<void>;
  pruneInactiveSnapshots(cutoff: number, batchSize?: number): Promise<number>;
  listRepos(): Promise<Repo[]>;
  getRepo(id: string): Promise<Repo | undefined>;
  enqueue(
    repo: Pick<Repo, "id" | "url" | "owner" | "name">,
  ): Promise<{ repo: Repo; job: Job }>;
  getJob(id: string): Promise<Job | undefined>;
  listJobs(repoId: string): Promise<Job[]>;
  capacity(): Promise<{
    nodes: number;
    relationships: number;
    nodeLimit: number;
    relationshipLimit: number;
    measurementsMs: { nodes: number; relationships: number };
  }>;
  claim(worker: string, repoId?: string): Promise<Job | undefined>;
  update(job: Job, patch: Partial<Job>): Promise<void>;
  saveAnalysis(job: Job, analysis: Analysis): Promise<void>;
  cachedEmbedding(contentHash: string): Promise<number[] | undefined>;
  saveEmbeddings(job: Job, chunks: Chunk[]): Promise<void>;
  activate(job: Job): Promise<void>;
  cancel(id: string): Promise<void>;
  deleteRepo(id: string): Promise<void>;
  snapshotReady(repo: Repo, snapshot: string): Promise<boolean>;
  getSnapshotCommit(repo: string, snapshot: string): Promise<string>;
  chunkSummary(snapshot: string): Promise<FileChunkSummary[]>;
  search(
    snapshot: string,
    query: string,
    vector?: number[],
  ): Promise<Evidence[]>;
  neighbors(snapshot: string, ids: string[]): Promise<Evidence[]>;
  symbols(
    snapshot: string,
    name: string,
  ): Promise<
    {
      id: string;
      name: string;
      path: string;
      scope: string;
      startLine: number;
    }[]
  >;
  history(
    repo: string,
    snapshot: string,
    conversation: string,
  ): Promise<{ question: string; answer: string }[]>;
  recordAnswer(
    repo: string,
    conversation: string,
    question: string,
    answer: Answer,
  ): Promise<void>;
  reserve(kind: "embedding" | "answer", tokens: number): Promise<void>;
  close(): Promise<void>;
}
