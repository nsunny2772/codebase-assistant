import type { Config } from "../config/index.js";
import type { QueryResult } from "neo4j-driver";

export interface MigrationContext {
  readonly config: Config;
  readonly embeddingLabel: string;
  readonly vectorIndex: string;
  run(
    cypher: string,
    parameters?: Record<string, unknown>,
  ): Promise<QueryResult>;
}

export interface Neo4jMigration {
  readonly id: string;
  up(context: MigrationContext): Promise<void>;
}
