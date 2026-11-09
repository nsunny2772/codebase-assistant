import { buildApp } from "./app.js";
import { loadConfig } from "./config/index.js";
import { commonStrings } from "./constants/common.js";
import { once } from "node:events";
import { configureLogger, logger } from "./utils/logger.js";

try {
  const config = loadConfig();
  configureLogger(config.LOG_LEVEL);

  const app = buildApp(config, { runIndexer: true });

  const server = app.listen(config.PORT, config.HOST);
  await once(server, "listening");
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      server.close(() => {
        void app.locals.shutdown().finally(() => {
          process.exitCode = 0;
        });
      });
    });
  }
} catch (error) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
  logger.error(commonStrings.BACKEND_STARTUP.replace("{code}", code), {
    code,
    error: error instanceof Error ? error.message : undefined,
  });
  process.exitCode = 1;
}
