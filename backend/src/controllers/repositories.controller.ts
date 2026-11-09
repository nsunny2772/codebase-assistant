import type { Response } from "express";

import type {
  IdRequest,
  SubmitRepositoryRequest,
  SymbolRequest,
} from "../routes/http.types.js";
import { routeId } from "../routes/http.types.js";
import { sendJson } from "../routes/serializers.js";
import type { RepositoryService } from "../services/repositories.service.js";

export const RepositoryController = (service: RepositoryService) => {
  const {
    getReposList,
    getRepository,
    addRepository,
    reindexRepository,
    deleteRepository,
    getRepositorySymbols,
    getRepositoryChunkSummary,
  } = service;

  const getReposListHandler = async (_request: IdRequest, response: Response) =>
    sendJson(response, {
      repositories: await getReposList(),
    });

  const getRepositoryHandler = async (request: IdRequest, response: Response) =>
    sendJson(response, {
      repository: await getRepository(routeId(request)),
    });

  const addRepositoryHandler = async (
    request: SubmitRepositoryRequest,
    response: Response,
  ) =>
    sendJson(
      response,
      await addRepository(request.body.url),
      202,
    );

  const reindexRepositoryHandler = async (
    request: IdRequest,
    response: Response,
  ) =>
    sendJson(
      response,
      await reindexRepository(routeId(request)),
      202,
    );

  const deleteRepositoryHandler = async (
    request: IdRequest,
    response: Response,
  ) => {
    await deleteRepository(routeId(request));
    return response.sendStatus(204);
  };

  const getRepositorySymbolsHandler = async (
    request: SymbolRequest,
    response: Response,
  ) =>
    sendJson(response, {
      symbols: await getRepositorySymbols(
        routeId(request),
        String(request.query.name),
      ),
    });

  const getRepositoryChunkSummaryHandler = async (
    request: IdRequest,
    response: Response,
  ) =>
    sendJson(response, {
      files: await getRepositoryChunkSummary(routeId(request)),
    });

  return {
    getReposList: getReposListHandler,
    getRepository: getRepositoryHandler,
    addRepository: addRepositoryHandler,
    reindexRepository: reindexRepositoryHandler,
    deleteRepository: deleteRepositoryHandler,
    getRepositorySymbols: getRepositorySymbolsHandler,
    getRepositoryChunkSummary: getRepositoryChunkSummaryHandler,
  };
};
