import type { RequestHandler } from "express";

import type { Config } from "../config/index.js";

const ALLOWED_METHODS = "GET, HEAD, POST, DELETE, OPTIONS";

const ALLOWED_HEADERS = "Content-Type, Authorization";

const PREFLIGHT_MAX_AGE_SECONDS = "600";

const isAllowedOrigin = (origin: string, host: string, publicOrigin: string) => {
  try {
    const requestOrigin = new URL(origin);
    return (
      requestOrigin.host === host ||
      requestOrigin.origin === new URL(publicOrigin).origin
    );
  } catch {
    return false;
  }
};

export const createCorsMiddleware = (config: Config): RequestHandler =>
  (request, response, next) => {
    const origin = request.get("Origin");

    if (
      !origin ||
      !isAllowedOrigin(origin, request.get("host") ?? "", config.PUBLIC_ORIGIN)
    )
      return next();

    response.vary("Origin");
    response.setHeader("Access-Control-Allow-Origin", origin);

    if (request.method !== "OPTIONS") return next();

    response.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    response.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    response.setHeader("Access-Control-Max-Age", PREFLIGHT_MAX_AGE_SECONDS);
    return response.sendStatus(204);
  };
