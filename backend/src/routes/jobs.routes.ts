import type { Express } from "express";

import type { ApplicationServices } from "../services/index.js";
import { JobController } from "../controllers/jobs.controller.js";
import { idParams } from "../validations/schemas.js";
import { validateRequest } from "../middlewares/validate-request.js";

export const registerJobRoutes = (
  app: Express,
  services: ApplicationServices,
) => {
  const jobs = JobController(services.jobs);
  app.get("/v1/jobs/:id", validateRequest("params", idParams), jobs.getJob);
  app.post(
    "/v1/jobs/:id/cancel",
    validateRequest("params", idParams),
    jobs.cancelJob,
  );
};
