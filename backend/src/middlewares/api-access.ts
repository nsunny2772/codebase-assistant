import type { RequestHandler } from "express";

import type { ServiceDependencies } from "../services/dependencies.js";
import { AppError } from "../utils/app-error.js";
import { commonStrings } from "../constants/common.js";

export const createApiAccessGuard =
  ({ config, store, ai }: ServiceDependencies) =>
  ((request, _response, next) => {
    try {
      if (!request.path.startsWith("/v1/")) return next();
      const origin = request.headers.origin;
      if (origin) {
        let host: string;
        try {
          host = new URL(origin).host;
        } catch {
          return next(new AppError("ORIGIN_DENIED", commonStrings.ORIGIN_DENIED, 403));
        }
        if (host !== request.headers.host && origin !== config.PUBLIC_ORIGIN)
          return next(new AppError("ORIGIN_DENIED", commonStrings.ORIGIN_DENIED, 403));
      }
      if (request.path === "/v1/openapi.json" || request.path === "/v1/capabilities") return next();
      if (!store || !ai)
        return next(new AppError("SERVICE_NOT_CONFIGURED", commonStrings.SERVICE_NOT_CONFIGURED, 503));
      next();
    } catch (error) {
      next(error);
    }
  }) satisfies RequestHandler;
