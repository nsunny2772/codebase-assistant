import type { Driver } from "neo4j-driver";
import type { Config } from "../config/index.js";
import type {
  Answer,
  Analysis,
  Chunk,
  Evidence,
  FileChunkSummary,
  Job,
  Repo,
} from "../models/index.js";
import { Neo4jContext } from "./neo4j-context.js";
import { Neo4jMigrationRunner } from "../migrations/migration-runner.js";
import { Neo4jBudgetRepository } from "./neo4j-budget.repository.js";
import { Neo4jConversationRepository } from "./neo4j-conversation.repository.js";
import { Neo4jIndexingRepository } from "./neo4j-indexing.repository.js";
import { Neo4jJobsRepository } from "./neo4j-jobs.repository.js";
import { Neo4jSearchRepository } from "./neo4j-search.repository.js";
import type { Store } from "./store.js";

export class Neo4jStore implements Store {
  private readonly context: Neo4jContext;

  private readonly budget: Neo4jBudgetRepository;

  private readonly conversation: Neo4jConversationRepository;

  private readonly indexing: Neo4jIndexingRepository;

  private readonly jobs: Neo4jJobsRepository;

  private readonly migrations: Neo4jMigrationRunner;

  private readonly searchRepository: Neo4jSearchRepository;

  constructor(driver: Driver, config: Config) {
    this.context = new Neo4jContext(driver, config);
    this.budget = new Neo4jBudgetRepository(this.context);
    this.conversation = new Neo4jConversationRepository(this.context);
    this.indexing = new Neo4jIndexingRepository(this.context);
    this.jobs = new Neo4jJobsRepository(this.context);
    this.migrations = new Neo4jMigrationRunner(driver, config);
    this.searchRepository = new Neo4jSearchRepository(this.context);
  }

  init() {
    return this.migrations.run();
  }

  async operationalReadiness() {
    const [migrationsReady, lastWorkerHeartbeat] = await Promise.all([
      this.migrations.status(),
      this.context.latestWorkerHeartbeat(),
    ]);
    return {
      migrationsReady,
      workerReady:
        lastWorkerHeartbeat !== undefined &&
        Date.now() - lastWorkerHeartbeat <=
          this.context.config.WORKER_HEARTBEAT_STALE_MS,
      ...(lastWorkerHeartbeat === undefined ? {} : { lastWorkerHeartbeat }),
    };
  }

  heartbeat(workerId: string) {
    return this.context.heartbeat(workerId);
  }

  retireWorker(workerId: string) {
    return this.context.retireWorker(workerId);
  }

  pruneInactiveSnapshots(cutoff: number, batchSize?: number) {
    return this.indexing.pruneInactiveSnapshots(cutoff, batchSize);
  }

  acquireSnapshotRead(repoId: string, snapshotId: string) {
    return this.indexing.acquireSnapshotRead(repoId, snapshotId);
  }

  releaseSnapshotRead(leaseId: string) {
    return this.indexing.releaseSnapshotRead(leaseId);
  }

  listRepos() {
    return this.jobs.listRepos();
  }

  getRepo(id: string) {
    return this.jobs.getRepo(id);
  }

  enqueue(repo: Pick<Repo, "id" | "url" | "owner" | "name">) {
    return this.jobs.enqueue(repo);
  }

  getJob(id: string) {
    return this.jobs.getJob(id);
  }

  listJobs(repoId: string) {
    return this.jobs.listJobs(repoId);
  }

  capacity() {
    return this.context.capacity();
  }

  claim(worker: string, repoId?: string) {
    return this.jobs.claim(worker, repoId);
  }

  update(job: Job, patch: Partial<Job>) {
    return this.jobs.update(job, patch);
  }

  saveAnalysis(job: Job, analysis: Analysis) {
    return this.indexing.saveAnalysis(job, analysis);
  }

  cachedEmbedding(contentHash: string) {
    return this.indexing.cachedEmbedding(contentHash);
  }

  saveEmbeddings(job: Job, chunks: Chunk[]) {
    return this.indexing.saveEmbeddings(job, chunks);
  }

  activate(job: Job) {
    return this.indexing.activate(job);
  }

  cancel(id: string) {
    return this.jobs.cancel(id);
  }

  deleteRepo(id: string) {
    return this.jobs.deleteRepo(id);
  }

  snapshotReady(repo: Repo, snapshot: string) {
    return this.indexing.snapshotReady(repo, snapshot);
  }

  getSnapshotCommit(repo: string, snapshot: string) {
    return this.indexing.getSnapshotCommit(repo, snapshot);
  }

  chunkSummary(snapshot: string): Promise<FileChunkSummary[]> {
    return this.indexing.chunkSummary(snapshot);
  }

  search(
    snapshot: string,
    query: string,
    vector?: number[],
  ): Promise<Evidence[]> {
    return this.searchRepository.search(snapshot, query, vector);
  }

  neighbors(snapshot: string, ids: string[]): Promise<Evidence[]> {
    return this.searchRepository.neighbors(snapshot, ids);
  }

  symbols(snapshot: string, name: string) {
    return this.searchRepository.symbols(snapshot, name);
  }

  history(repo: string, snapshot: string, conversation: string) {
    return this.conversation.history(repo, snapshot, conversation);
  }

  recordAnswer(
    repo: string,
    conversation: string,
    question: string,
    answer: Answer,
  ) {
    return this.conversation.recordAnswer(repo, conversation, question, answer);
  }

  reserve(kind: "embedding" | "answer", tokens: number) {
    return this.budget.reserve(kind, tokens);
  }

  close() {
    return this.context.close();
  }
}
