import { setTimeout as delay } from "node:timers/promises";
import { ANALYSIS_VERSION } from "../../constants/analysis.js";
import { repositoryStrings } from "../../constants/repository.js";
import { indexingStrings } from "../../constants/indexing.js";
import { randomUUID } from "node:crypto";
import { type Config, embeddingIdentity } from "../../config/index.js";
import { type Job, type Analysis } from "../../models/index.js";
import { AppError } from "../../utils/app-error.js";
import { hash } from "../../utils/hash.js";
import type { Store } from "../../repositories/store.js";
import type { AI } from "../ai.js";
import { GitHubSource } from "./github.js";
import { countTokens } from "../retrieval/context.js";
import { analyzeRepository } from "../analysis/parser.js";
import { isRetryableError } from "neo4j-driver";

export const indexRetryDelay = (
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
) => Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));

export class Indexer {
  readonly workerId = randomUUID();

  constructor(
    private store: Store,
    private source: Pick<GitHubSource, "resolve" | "download">,
    private ai: AI,
    private config: Config,
  ) {}

  async run(job: Job, signal: AbortSignal) {
    const abort = new AbortController();

    const combined = AbortSignal.any([
      signal,
      abort.signal,
      AbortSignal.timeout(10 * 60 * 1000),
    ]);
    let renewing = false;
    const heartbeat = setInterval(() => {
      if (renewing) return;
      renewing = true;
      void this.store
        .update(job, {})
        .catch(() => abort.abort())
        .finally(() => {
          renewing = false;
        });
    }, 15000);
    try {
      const repo = await this.store.getRepo(job.repoId);
      if (!repo)
        throw new AppError(
          "REPOSITORY_NOT_FOUND",
          repositoryStrings.NO_LONGER_AVAILABLE,
          404,
        );
      const commit = await this.source.resolve(repo, combined);
      if (
        repo.commit === commit &&
        repo.activeSnapshot &&
        (await this.store.snapshotReady(repo, repo.activeSnapshot))
      ) {
        await this.store.update(job, {
          status: "READY",
          commit,
          snapshotId: repo.activeSnapshot,
        });
        return;
      }
      const snapshotId = hash(
        `${repo.id}:${commit}:${ANALYSIS_VERSION}:context-chunks-v2:${embeddingIdentity(this.config)}:${job.id}`,
      );
      await this.store.update(job, { commit, snapshotId, status: "FETCHING" });
      const downloaded = await this.source.download(repo, commit, combined);
      await this.store.update(job, {
        status: "PARSING",
        files: downloaded.files.length,
      });
      const analysis = await analyzeRepository(downloaded.files, snapshotId);
      if (!analysis.chunks.length)
        throw new AppError(
          "NO_CODE_CHUNKS",
          indexingStrings.NO_CHUNKS,
        );
      await this.store.update(job, {
        chunks: analysis.chunks.length,
        warnings: [
          ...downloaded.warnings,
          ...analysis.warnings,
          indexingStrings.UNRESOLVED_CALL_SITES(analysis.unresolvedCalls),
        ].slice(0, 100),
      });
      await this.store.saveAnalysis(job, analysis);
      await this.store.update(job, { status: "EMBEDDING" });
      await this.embed(job, analysis, combined);
      await this.store.update(job, { status: "VERIFYING" });
      combined.throwIfAborted();
      await this.store.activate(job);
    } catch (error) {
      const code =
        error instanceof AppError
          ? error.code
          : combined.aborted
            ? "INDEXING_ABORTED"
            : "INDEXING_FAILED";
      // Persist safe codes only. Partial snapshots never replace the active pointer.
      try {
        const retryable =
          !combined.aborted &&
          job.attempt < this.config.INDEX_MAX_ATTEMPTS &&
          ((error instanceof AppError && error.retryable) ||
            isRetryableError(error));
        if (retryable) {
          const delayMs = indexRetryDelay(
            job.attempt,
            this.config.INDEX_RETRY_BASE_DELAY_MS,
            this.config.INDEX_RETRY_MAX_DELAY_MS,
          );
          await this.store.update(job, {
            status: "QUEUED",
            error: code,
            nextAttemptAt: Date.now() + delayMs,
            leaseOwner: "",
          });
        } else {
          await this.store.update(job, {
            status: "FAILED",
            error: code,
            nextAttemptAt: 0,
          });
        }
      } catch {
        /* Lost lease or cancellation owns the final state. */
      }
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async embed(job: Job, analysis: Analysis, signal: AbortSignal) {
    let tokens = 0,
      done = 0;
    for (
      let i = 0;
      i < analysis.chunks.length;
      i += this.config.EMBEDDING_BATCH_SIZE
    ) {
      signal.throwIfAborted();
      const batch = analysis.chunks.slice(
        i,
        i + this.config.EMBEDDING_BATCH_SIZE,
      );

      const cache = new Map<string, number[]>();
      for (const chunk of batch) {
        const cached =
          cache.get(chunk.contentHash) ??
          (await this.store.cachedEmbedding(chunk.contentHash));
        if (cached) {
          chunk.embedding = cached;
          cache.set(chunk.contentHash, cached);
        }
      }
      const pending = batch.filter((c) => !c.embedding);
      if (pending.length) {
        if (i > 0 && this.config.EMBEDDING_BATCH_DELAY_MS)
          await delay(this.config.EMBEDDING_BATCH_DELAY_MS, undefined, {
            signal,
          });
        const needed = pending.reduce(
          (sum, c) => sum + countTokens(c.embeddingText ?? c.text),
          0,
        );
        tokens += needed;
        if (tokens > this.config.MAX_EMBEDDING_TOKENS_PER_JOB)
          throw new AppError(
            "JOB_BUDGET",
            indexingStrings.JOB_BUDGET,
            413,
          );
        await this.store.reserve("embedding", Math.ceil(needed * 1.25));
        const vectors = await this.ai.embed(
          pending.map((c) => c.embeddingText ?? c.text),
          signal,
          "document",
        );
        pending.forEach((c, n) => {
          c.embedding = vectors[n];
        });
      }
      await this.store.saveEmbeddings(job, batch);
      done += batch.length;
      await this.store.update(job, { completedChunks: done });
    }
  }
}
