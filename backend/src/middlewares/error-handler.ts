import type { ErrorRequestHandler, Express } from "express";
import * as yup from "yup";

import { AppError } from "../utils/app-error.js";
import { commonStrings } from "../constants/common.js";
import { sendJson } from "../routes/serializers.js";
import { createLogger } from "../utils/logger.js";

const errorLogger = createLogger({ module: "http" });

export const registerErrorHandler = (app: Express) => {
  const handleError: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    void _next;
    if (error instanceof AppError) {
      return void sendJson(
        response,
        {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          requestId: response.locals.requestId,
        },
        error.statusCode,
      );
    }
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return void sendJson(
        response,
        {
          code: "DEADLINE_EXCEEDED",
          message: commonStrings.DEADLINE_EXCEEDED,
          retryable: true,
          requestId: response.locals.requestId,
        },
        504,
      );
    }
    if (error instanceof Error && error.name === "Neo4jError") {
      return void sendJson(
        response,
        {
          code: "DATABASE_UNAVAILABLE",
          message: commonStrings.DATABASE_UNAVAILABLE,
          retryable: true,
          requestId: response.locals.requestId,
        },
        503,
      );
    }
    const statusCode =
      error instanceof yup.ValidationError
        ? 400
        : error && typeof error === "object" && "statusCode" in error
          ? error.statusCode
          : undefined;

    const status =
      typeof statusCode === "number" && statusCode >= 400 && statusCode < 500
        ? statusCode
        : 500;
    errorLogger.error(commonStrings.REQUEST_FAILED, {
      requestId: response.locals.requestId,
      status,
    });
    void sendJson(
      response,
      {
        code: status === 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST",
        message:
          status === 500
            ? commonStrings.INTERNAL_ERROR
            : commonStrings.INVALID_REQUEST,
        requestId: response.locals.requestId,
      },
      status,
    );
  };
  app.use(handleError);
};
