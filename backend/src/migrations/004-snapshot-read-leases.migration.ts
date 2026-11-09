import type { Neo4jMigration } from "./migration.types.js";

export const snapshotReadLeaseMigration: Neo4jMigration = {
  id: "004-snapshot-read-leases",
  async up({ run }) {
    await run(
      "CREATE CONSTRAINT ca_snapshotreadlease_id IF NOT EXISTS FOR (n:SnapshotReadLease) REQUIRE n.id IS UNIQUE",
    );
    await run(
      "CREATE INDEX ca_snapshot_lease_expiry IF NOT EXISTS FOR (n:SnapshotReadLease) ON (n.snapshotId, n.expiresAt)",
    );
    // Repeat idempotent indexes from migration 003 in case an early local worker
    // applied that migration before the index additions were committed.
    await run(
      "CREATE INDEX ca_repository_active_snapshot IF NOT EXISTS FOR (n:Repository) ON (n.activeSnapshot)",
    );
    await run(
      "CREATE INDEX ca_job_snapshot_status IF NOT EXISTS FOR (n:IndexJob) ON (n.snapshotId, n.status)",
    );
  },
};
