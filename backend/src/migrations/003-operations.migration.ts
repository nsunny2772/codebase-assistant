import type { Neo4jMigration } from "./migration.types.js";

export const operationsMigration: Neo4jMigration = {
  id: "003-operations-and-retention",
  async up({ run }) {
    await run(
      "CREATE CONSTRAINT ca_workerheartbeat_id IF NOT EXISTS FOR (n:WorkerHeartbeat) REQUIRE n.id IS UNIQUE",
    );
    await run(
      "CREATE INDEX ca_snapshot_created IF NOT EXISTS FOR (n:Snapshot) ON (n.createdAt)",
    );
    await run(
      "CREATE INDEX ca_repository_active_snapshot IF NOT EXISTS FOR (n:Repository) ON (n.activeSnapshot)",
    );
    await run(
      "CREATE INDEX ca_job_snapshot_status IF NOT EXISTS FOR (n:IndexJob) ON (n.snapshotId, n.status)",
    );
    await run(
      `MATCH (s:Snapshot) WHERE s.createdAt IS NULL
       OPTIONAL MATCH (j:IndexJob {snapshotId:s.id})
       WITH s, coalesce(min(j.createdAt), timestamp()) AS createdAt
       SET s.createdAt=createdAt`,
    );
  },
};
