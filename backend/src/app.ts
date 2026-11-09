import express from "express";
import type { Config } from "./config/index.js";
import { missingEmbeddingCredentials } from "./config/index.js";
import { createNeo4jDriver } from "./connection/neo4j.connection.js";
import rateLimit from "express-rate-limit";
import { Neo4jStore } from "./repositories/neo4j.repository.js";
import type { Store } from "./repositories/store.js";
import type { AI } from "./services/ai.js";
import { createAI } from "./services/provider.js";
import { registerRoutes } from "./routes/index.js";
import { createApplicationServices } from "./services/index.js";
import { commonStrings } from "./constants/common.js";
import { createIndexingWorker } from "./services/indexing-worker.service.js";
import { registerErrorHandler } from "./middlewares/error-handler.js";
import { registerRequestLogging } from "./middlewares/request-logger.js";
import { createCorsMiddleware } from "./middlewares/cors.js";
import { sendJson } from "./routes/serializers.js";
import { configureLogger, createLogger } from "./utils/logger.js";

export function buildApp(
  config: Config,
  options: {
    checkDatabase?: () => Promise<void>;
    checkOperational?: () => Promise<{
      migrationsReady: boolean;
      workerReady: boolean;
      lastWorkerHeartbeat?: number;
    }>;
    store?: Store;
    ai?: AI;
    runIndexer?: boolean;
  } = {},
) {
  const app = express();
  configureLogger(config.LOG_LEVEL);
  const appLogger = createLogger({ module: "api" });
  app.disable("x-powered-by");
  registerRequestLogging(app);
  app.use(createCorsMiddleware(config));
  app.use(express.json({ limit: 64 * 1024 }));
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 60,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_request, response) =>
        sendJson(
          response,
          {
            code: "INVALID_REQUEST",
            message: commonStrings.INVALID_REQUEST,
            requestId: response.locals.requestId,
          },
          429,
        ),
    }),
  );

  const driver =
    !options.checkDatabase && config.NEO4J_URI && config.NEO4J_PASSWORD
      ? createNeo4jDriver(config)
      : undefined;

  const checkDatabase =
    options.checkDatabase ??
    (async () => {
      if (!driver) throw new Error(commonStrings.DATABASE_NOT_CONFIGURED);
      await driver.executeQuery(
        "RETURN 1 AS ok",
        {},
        { database: config.NEO4J_DATABASE, routing: "READ" },
      );
    });

  const store =
    options.store ??
    (driver && missingEmbeddingCredentials(config).length === 0
      ? new Neo4jStore(driver, config)
      : undefined);

  const ai = options.ai ?? (store ? createAI(config) : undefined);

  const indexingWorker =
    options.runIndexer && store && ai
      ? createIndexingWorker(store, ai, config)
      : undefined;

  indexingWorker?.start();
  if (options.runIndexer && !indexingWorker)
    appLogger.info(commonStrings.WORKER_IDLE);

  const checkOperational =
    options.checkOperational ??
    (() =>
      store
        ? store.operationalReadiness()
        : Promise.resolve({ migrationsReady: false, workerReady: false }));

  const dependencies = { config, store, ai };

  const services = createApplicationServices(
    dependencies,
    checkDatabase,
    checkOperational,
  );

  registerRoutes(app, dependencies, services);
  registerErrorHandler(app);
  app.use((_request, response) =>
    sendJson(
      response,
      {
        code: "INVALID_REQUEST",
        message: commonStrings.INVALID_REQUEST,
        requestId: response.locals.requestId,
      },
      404,
    ),
  );
  app.locals.shutdown = async () => {
    await indexingWorker?.stop();
    await driver?.close();
  };
  return app;
}
