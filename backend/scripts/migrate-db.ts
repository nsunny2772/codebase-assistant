import { loadConfig } from "../src/config/index.js";
import { createNeo4jDriver } from "../src/connection/neo4j.connection.js";
import { Neo4jStore } from "../src/repositories/neo4j.repository.js";
import { scriptStrings } from "./constants.mjs";
import { configureLogger, logger } from "../src/utils/logger.js";

const config = loadConfig();
configureLogger(config.LOG_LEVEL);

const store = new Neo4jStore(createNeo4jDriver(config), config);
try {
  await store.init();
  logger.info(scriptStrings.DATABASE_READY);
} catch {
  logger.error(scriptStrings.DATABASE_INIT_FAILED);
  process.exitCode = 1;
} finally {
  await store.close();
}
