import type { Neo4jMigration } from "./migration.types.js";

const labels = [
  "Repository",
  "IndexJob",
  "Snapshot",
  "Symbol",
  "CodeChunk",
  "Budget",
  "QueryRun",
] as const;

export const coreSchemaMigration: Neo4jMigration = {
  id: "001-core-schema",
  async up({ run }) {
    for (const label of labels) {
      await run(
        `CREATE CONSTRAINT ca_${label.toLowerCase()}_id IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`,
      );
    }

    await run(
      "CREATE INDEX ca_chunk_snapshot IF NOT EXISTS FOR (n:CodeChunk) ON (n.snapshotId)",
    );
    await run(
      "CREATE INDEX ca_symbol_snapshot IF NOT EXISTS FOR (n:Symbol) ON (n.snapshotId)",
    );
    await run(
      "CREATE INDEX ca_chunk_hash IF NOT EXISTS FOR (n:CodeChunk) ON (n.contentHash, n.embeddingModel)",
    );
    await run(
      "CREATE INDEX ca_job_repository IF NOT EXISTS FOR (n:IndexJob) ON (n.repoId)",
    );
    await run(
      "CREATE FULLTEXT INDEX ca_chunks_text IF NOT EXISTS FOR (n:CodeChunk) ON EACH [n.text, n.name, n.path]",
    );
  },
};
