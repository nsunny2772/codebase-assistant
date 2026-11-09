import type { Express } from "express";

import type { ApplicationServices } from "../services/index.js";
import { RepositoryController } from "../controllers/repositories.controller.js";
import { JobController } from "../controllers/jobs.controller.js";
import { QuestionController } from "../controllers/questions.controller.js";
import {
  idParams,
  repositoryBody,
  symbolQuery,
  questionBody,
} from "../validations/schemas.js";
import { validateRequest } from "../middlewares/validate-request.js";

export const registerRepositoryRoutes = (
  app: Express,
  services: ApplicationServices,
) => {
  const repositories = RepositoryController(services.repositories),
    jobs = JobController(services.jobs),
    questions = QuestionController(services.questions);
  app.get("/v1/repositories", repositories.getReposList);
  app.post(
    "/v1/repositories",
    validateRequest("body", repositoryBody),
    repositories.addRepository,
  );
  app.get(
    "/v1/repositories/:id",
    validateRequest("params", idParams),
    repositories.getRepository,
  );
  app.get(
    "/v1/repositories/:id/jobs",
    validateRequest("params", idParams),
    jobs.getRepositoryJobs,
  );
  app.get(
    "/v1/repositories/:id/chunks",
    validateRequest("params", idParams),
    repositories.getRepositoryChunkSummary,
  );
  app.post(
    "/v1/repositories/:id/refresh",
    validateRequest("params", idParams),
    repositories.reindexRepository,
  );
  app.delete(
    "/v1/repositories/:id",
    validateRequest("params", idParams),
    repositories.deleteRepository,
  );
  app.get(
    "/v1/repositories/:id/symbols",
    validateRequest("params", idParams),
    validateRequest("query", symbolQuery),
    repositories.getRepositorySymbols,
  );
  app.post(
    "/v1/repositories/:id/questions",
    validateRequest("params", idParams),
    validateRequest("body", questionBody),
    questions.askAboutRepository,
  );
};
