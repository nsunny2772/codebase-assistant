import type { Express } from "express";

import type { ApplicationServices } from "../services/index.js";
import type { ServiceDependencies } from "../services/dependencies.js";
import { createApiAccessGuard } from "../middlewares/api-access.js";
import { registerRepositoryRoutes } from "./repositories.routes.js";
import { registerJobRoutes } from "./jobs.routes.js";
import { registerSystemRoutes } from "./system.routes.js";

export const registerRoutes = (
  app: Express,
  dependencies: ServiceDependencies,
  services: ApplicationServices,
) => {
  app.use(createApiAccessGuard(dependencies));
  registerSystemRoutes(app, services);
  registerRepositoryRoutes(app, services);
  registerJobRoutes(app, services);
};
