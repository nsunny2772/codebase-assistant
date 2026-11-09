import {
  missingCredentials,
  answerModel,
  embeddingModel,
  embeddingDimensions,
} from "../config/index.js";
import { PROJECT_PROFILES } from "../constants/project-profiles.js";
import { systemStrings } from "../constants/system.js";
import { CHUNK_POLICY } from "../constants/chunking.js";
import { requireStore, type ServiceDependencies } from "./dependencies.js";

export const createSystemService = (
  dependencies: ServiceDependencies,
  checkDatabase: () => Promise<void>,
  checkOperational: () => Promise<{
    migrationsReady: boolean;
    workerReady: boolean;
    lastWorkerHeartbeat?: number;
  }>,
) => {
  const { config } = dependencies;

  const capacity = () => requireStore(dependencies).capacity();

  const live = () => ({ status: "ok" as const });

  const ready = async () => {
    const missing = missingCredentials(config);
    if (missing.length)
      return {
        status: "not_ready" as const,
        reason: "configuration_missing",
        missing,
      };
    try {
      await checkDatabase();
    } catch {
      return { status: "not_ready" as const, reason: "database_unavailable" };
    }
    let operational: Awaited<ReturnType<typeof checkOperational>>;
    try {
      operational = await checkOperational();
    } catch {
      return { status: "not_ready" as const, reason: "database_unavailable" };
    }
    if (!operational.migrationsReady)
      return {
        status: "not_ready" as const,
        reason: "migrations_pending",
        migrationsReady: false,
        workerReady: operational.workerReady,
      };
    if (!operational.workerReady)
      return {
        status: "not_ready" as const,
        reason: "worker_unavailable",
        migrationsReady: true,
        workerReady: false,
      };
    return {
      status: "ready" as const,
      migrationsReady: true,
      workerReady: true,
      ...(operational.lastWorkerHeartbeat === undefined
        ? {}
        : { lastWorkerHeartbeat: operational.lastWorkerHeartbeat }),
    };
  };

  const capabilities = () => ({
    languages: ["JavaScript", "TypeScript", "Python", "Markdown"],
    profiles: PROJECT_PROFILES,
    limitations: [
      systemStrings.STATIC_ANALYSIS,
      systemStrings.DYNAMIC_BEHAVIOR,
    ],
    readOnly: true,
    embedding: {
      provider: config.EMBEDDING_PROVIDER,
      model: embeddingModel(config),
      dimensions: embeddingDimensions(config),
    },
    chunking: CHUNK_POLICY,
    maxFiles: config.MAX_SOURCE_FILES,
    maxRepositoryBytes: config.MAX_REPOSITORY_BYTES,
    answerModelConfigured: Boolean(answerModel(config)),
  });
  return { capacity, live, ready, capabilities };
};

export type SystemService = ReturnType<typeof createSystemService>;
