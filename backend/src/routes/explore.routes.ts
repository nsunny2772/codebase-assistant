import type { Express } from "express";

import type { ApplicationServices } from "../services/index.js";
import { ExploreController } from "../controllers/explore.controller.js";
import { exploreRepositoryQuery } from "../validations/schemas.js";
import { validateRequest } from "../middlewares/validate-request.js";

export const registerExploreRoutes = (
  app: Express,
  services: ApplicationServices,
) => {
  const explore = ExploreController(services.explore);
  app.get(
    "/v1/explore/repositories",
    validateRequest("query", exploreRepositoryQuery),
    explore.searchPublicRepositories,
  );
};
