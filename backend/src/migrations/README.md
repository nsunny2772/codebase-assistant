# Neo4j migrations

`migration-runner.ts` applies the migrations in order and records completed IDs
in the `SchemaMigration` label. It takes a database-backed lease so concurrent
backend startup and explicit migration commands do not apply the same migration
simultaneously.

Neo4j schema statements run as auto-commit queries, not inside the data
transaction that records the migration. Each migration therefore must be safe
to retry after partial completion (for example, use `IF NOT EXISTS` and
idempotent `MERGE` operations). The migration ID is written only after `up`
finishes successfully.

To add a migration, create the next numbered `*.migration.ts` file, make its
`up` operation restart-safe, then register it in `migration-runner.ts` after
the existing migrations. Run `npm run db:migrate -w backend` from the project
root to apply pending migrations. The in-process indexing worker also applies
them during backend startup.

The vector-index migration ID includes the embedding model identity because
each model/dimension generation uses a separately named Neo4j vector index.
Migration 003 adds worker-heartbeat and snapshot-retention metadata. Existing
snapshots are backfilled from their indexing job creation time; snapshots with
no matching job are timestamped at migration time so they are not immediately
eligible for cleanup.
