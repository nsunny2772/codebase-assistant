import { parseRepository } from "../validations/repository.validation.js";
import { commonStrings } from "../constants/common.js";
import { repositoryStrings } from "../constants/repository.js";
import { AppError } from "../utils/app-error.js";
import { requireStore, type ServiceDependencies } from "./dependencies.js";

export const createRepositoryService = (dependencies: ServiceDependencies) => {
  const getReposList = () => requireStore(dependencies).listRepos();

  const getRepository = async (id: string) => {
    const repo = await requireStore(dependencies).getRepo(id);
    if (!repo)
      throw new AppError("NOT_FOUND", commonStrings.REPOSITORY_NOT_FOUND, 404);
    return repo;
  };

  const addRepository = (url: string) =>
    requireStore(dependencies).enqueue(parseRepository(url));

  const reindexRepository = async (id: string) =>
    requireStore(dependencies).enqueue(await getRepository(id));

  const deleteRepository = (id: string) =>
    requireStore(dependencies).deleteRepo(id);

  const getRepositorySymbols = async (id: string, name: string) => {
    const repo = await getRepository(id);
    if (!repo.activeSnapshot)
      throw new AppError(
        "SNAPSHOT_NOT_READY",
        repositoryStrings.INDEXING_NOT_COMPLETED,
        409,
      );
    return requireStore(dependencies).symbols(repo.activeSnapshot, name);
  };

  const getRepositoryChunkSummary = async (id: string) => {
    const repo = await getRepository(id);
    if (!repo.activeSnapshot) return [];
    return requireStore(dependencies).chunkSummary(repo.activeSnapshot);
  };
  return {
    getReposList,
    getRepository,
    addRepository,
    reindexRepository,
    deleteRepository,
    getRepositorySymbols,
    getRepositoryChunkSummary,
  };
};

export type RepositoryService = ReturnType<typeof createRepositoryService>;
