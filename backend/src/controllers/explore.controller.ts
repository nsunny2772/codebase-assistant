import type { Response } from "express";

import { sendJson } from "../routes/serializers.js";
import type { ExploreRepositoryQuery } from "../services/explore.service.js";
import type { QueryRequest } from "../routes/http.types.js";

export interface ExploreService {
  searchPublicRepositories: (
    query: ExploreRepositoryQuery,
  ) => Promise<unknown>;
}

export const ExploreController = (service: ExploreService) => {
  const searchPublicRepositories = async (
    request: QueryRequest,
    response: Response,
  ) => {
    const { query, language, sort, page } = request.query;

    const results = await service.searchPublicRepositories({
      query: String(query ?? ""),
      language: language ? String(language) : undefined,
      sort: sort === "updated" ? "updated" : "stars",
      page: Number(page ?? 1),
    });
    return sendJson(response, results);
  };

  return { searchPublicRepositories };
};
