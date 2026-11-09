import type { ServiceDependencies } from "./dependencies.js";
import { createRepositoryService } from "./repositories.service.js";
import { createJobService } from "./jobs.service.js";
import { createQuestionService } from "./questions.service.js";
import { createSystemService } from "./system.service.js";

export const createApplicationServices = (
  dependencies: ServiceDependencies,
  checkDatabase: () => Promise<void>,
  checkOperational: () => Promise<{
    migrationsReady: boolean;
    workerReady: boolean;
    lastWorkerHeartbeat?: number;
  }>,
) => {
  const repositories = createRepositoryService(dependencies);
  return {
    repositories,
    jobs: createJobService(dependencies, repositories),
    questions: createQuestionService(dependencies, repositories),
    system: createSystemService(dependencies, checkDatabase, checkOperational),
  };
};

export type ApplicationServices = ReturnType<typeof createApplicationServices>;
