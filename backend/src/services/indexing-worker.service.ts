import { setTimeout as delay } from "node:timers/promises";

import { commonStrings } from "../constants/common.js";
import type { Config } from "../config/index.js";
import type { Store } from "../repositories/store.js";
import type { AI } from "./ai.js";
import { GitHubSource } from "./ingestion/github.js";
import { Indexer } from "./ingestion/indexer.js";
import { createLogger } from "../utils/logger.js";

export const createIndexingWorker = (
  store: Store,
  ai: AI,
  config: Config,
) => {
  const workerLogger = createLogger({ module: "indexing" });

  const indexer = new Indexer(store, new GitHubSource(config), ai, config);

  const workerId = indexer.workerId;

  const stopController = new AbortController();
  let runPromise: Promise<void> | undefined;

  const wait = async (milliseconds: number) => {
    try {
      await delay(milliseconds, undefined, { signal: stopController.signal });
    } catch {
      // Abort ends the worker loop during application shutdown.
    }
  };

  const run = async () => {
    let initialized = false;
    let heartbeat: NodeJS.Timeout | undefined;
    let cleanup: NodeJS.Timeout | undefined;

    try {
      while (!stopController.signal.aborted) {
        try {
          if (!initialized) {
            await store.init();
            await store.heartbeat(workerId);
            initialized = true;

            let heartbeatRunning = false;
            heartbeat = setInterval(() => {
              if (heartbeatRunning) return;
              heartbeatRunning = true;
              void store
                .heartbeat(workerId)
                .catch(() => workerLogger.error(commonStrings.WORKER_HEARTBEAT_FAILED))
                .finally(() => {
                  heartbeatRunning = false;
                });
            }, config.WORKER_HEARTBEAT_INTERVAL_MS);

            let cleanupRunning = false;
            cleanup = setInterval(() => {
              if (cleanupRunning) return;
              cleanupRunning = true;
              const cutoff =
                Date.now() - config.INACTIVE_SNAPSHOT_RETENTION_DAYS * 86400000;
              void store
                .pruneInactiveSnapshots(cutoff)
                .then((deleted) => {
                  if (deleted)
                    workerLogger.info("Inactive snapshots pruned", {
                      event: "inactive_snapshots_pruned",
                      count: deleted,
                    });
                })
                .catch(() => workerLogger.error(commonStrings.SNAPSHOT_CLEANUP_FAILED))
                .finally(() => {
                  cleanupRunning = false;
                });
            }, config.SNAPSHOT_CLEANUP_INTERVAL_MS);

            workerLogger.info(commonStrings.WORKER_READY);
          }

          const job = await store.claim(workerId);
          if (!job) {
            await wait(1500);
            continue;
          }

          const started = Date.now();
          workerLogger.info("Indexing job started", {
              event: "index_job_started",
              jobId: job.id,
              repoId: job.repoId,
              attempt: job.attempt,
            });
          await indexer.run(job, stopController.signal);
          const final = await store.getJob(job.id);
          workerLogger.info("Indexing job finished", {
              event: "index_job_finished",
              jobId: job.id,
              status: final?.status,
              error: final?.error,
              elapsedMs: Date.now() - started,
            });
        } catch {
          if (stopController.signal.aborted) break;
          workerLogger.error(
            initialized
              ? commonStrings.WORKER_ITERATION_FAILED
              : commonStrings.WORKER_STARTUP_FAILED.replace("{code}", "unknown"),
          );
          await wait(initialized ? 3000 : 5000);
        }
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (cleanup) clearInterval(cleanup);
      if (initialized) await store.retireWorker(workerId).catch(() => undefined);
    }
  };

  const start = () => {
    if (!runPromise) runPromise = run();
  };

  const stop = async () => {
    stopController.abort();
    await runPromise;
  };

  return { start, stop };
};
