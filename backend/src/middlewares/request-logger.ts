import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { commonStrings } from "../constants/common.js";
import { createLogger } from "../utils/logger.js";

const requestLogger = createLogger({ module: "http" });

export const registerRequestLogging = (app: Express) => {
  app.use((request, response, next) => {
    const requestId = randomUUID();

    const startedAt = performance.now();
    response.locals.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    response.once("finish", () => {
      if (request.path.startsWith("/v1/"))
        requestLogger.info(commonStrings.REQUEST_COMPLETE, {
            requestId,
            method: request.method,
            path: request.path,
            status: response.statusCode,
            elapsedMs: Math.round(performance.now() - startedAt),
          });
    });
    next();
  });
};

