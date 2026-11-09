import neo4j from "neo4j-driver";
import type { Config } from "../config/index.js";

export function createNeo4jDriver(config: Config) {
  return neo4j.driver(
    config.NEO4J_URI,
    neo4j.auth.basic(config.NEO4J_USERNAME, config.NEO4J_PASSWORD),
    {
      connectionAcquisitionTimeout: 5000,
      connectionTimeout: 5000,
      maxTransactionRetryTime: 5000,
      maxConnectionPoolSize: 10,
      disableLosslessIntegers: true,
    },
  );
}
