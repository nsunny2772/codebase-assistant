import type { Express } from "express";

import type { ApplicationServices } from "../services/index.js";
import { SystemController } from "../controllers/system.controller.js";

export const registerSystemRoutes = (
  app: Express,
  services: ApplicationServices,
) => {
  const system = SystemController(services.system);
  app.get("/health/live", system.getLiveness);
  app.get("/health/ready", system.getReadiness);
  app.get("/v1/openapi.json", system.getOpenApiDocument);
  app.get("/v1/capacity", system.getSystemCapacity);
  app.get("/v1/capabilities", system.getSystemCapabilities);
};
