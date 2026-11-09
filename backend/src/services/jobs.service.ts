import { AppError } from "../utils/app-error.js";
import { commonStrings } from "../constants/common.js";
import { requireStore, type ServiceDependencies } from "./dependencies.js";
import type { RepositoryService } from "./repositories.service.js";

export const createJobService = (
  dependencies: ServiceDependencies,
  repositories: RepositoryService,
) => {
  const get = async (id: string) => {
    const job = await requireStore(dependencies).getJob(id);
    if (!job) throw new AppError("NOT_FOUND", commonStrings.JOB_NOT_FOUND, 404);
    return job;
  };

  const list = async (repoId: string) => {
    await repositories.getRepository(repoId);
    return requireStore(dependencies).listJobs(repoId);
  };

  const cancel = (id: string) => requireStore(dependencies).cancel(id);
  return { get, list, cancel };
};

export type JobService = ReturnType<typeof createJobService>;
