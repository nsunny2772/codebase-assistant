# Operations and troubleshooting

## Health and readiness

`GET /health/live` reports whether the HTTP process is alive. It does not depend on worker availability. `GET /health/ready` checks required provider/database configuration, Neo4j connectivity, migrations, and a recent worker heartbeat. A 503 readiness result means the API process may still be live, but indexing or answering is not ready. Health checks do not make paid provider calls.

## Indexing status and recovery

Job records expose status, file/chunk coverage, warnings, and safe failure information. The worker runs inside the backend process, records heartbeats, and recovers jobs whose leases expire. Indexing retries only transient errors, with exponential backoff and a configured maximum attempt count (`INDEX_MAX_ATTEMPTS`, default 3). Provider authentication, billing, validation, and other permanent failures are not retried automatically.

After repeated failure, inspect the job error and warnings, confirm provider limits and configuration, and retry by reindexing after the cause is addressed. Completed embedding checkpoints can be reused. A replacement snapshot becomes active only after indexing succeeds; the prior active snapshot remains queryable if reindexing fails. Cancellation prevents subsequent writes and snapshot activation.

Never run repository scripts or install a repository's dependencies to diagnose indexing.

## Neo4j capacity and cleanup

`GET /v1/capacity` reports graph node and relationship counts and configured ingestion limits. Defaults are 180,000 nodes and 360,000 relationships. These are application safety caps, not Neo4j license or memory limits. Capacity accounting assumes the supported single worker.

Inactive snapshots are cleaned up according to `INACTIVE_SNAPSHOT_RETENTION_DAYS` (default 30 days), on `SNAPSHOT_CLEANUP_INTERVAL_MS` (default one hour). Cleanup preserves each repository's active snapshot, in-progress work, and snapshots protected by active read leases. Repository deletion is a separate explicit operation and is idempotent after interruption.

## Provider and budget issues

Groq answers and Voyage embeddings use backend-only API keys. Daily token reservations are stored in Neo4j and bounded by `DAILY_ANSWER_TOKEN_LIMIT` and `DAILY_EMBEDDING_TOKEN_LIMIT`. Estimates can differ from billed usage. Provider account-side monetary limits should also be configured. Do not retry authentication, billing, or quota failures by repeatedly resubmitting work.

Model-generated answers are grounded with retrieved source chunks and commit-specific citations, but citation validity does not prove that every answer claim is correct. Report the run ID, repository, snapshot commit, question, and citations when investigating an answer.

## Security and access

The application supports public repositories and has no user accounts, tenant ownership, or API user authentication. Origin checks and process-level rate limits are not authentication. Do not expose the service publicly without a reviewed access-control design. Provider keys and database credentials belong only in `backend/.env` or a deployment secret store.

Logs use request IDs and safe error details. Do not log repository source, prompts, provider response bodies, or secrets. The Winston wrapper and HTTP logging middleware are in `backend/src/utils/logger.ts` and `backend/src/middlewares/request-logger.ts`.

## Current local verification and deployment limits

On 10 November 2026, the backend returned 200 for liveness and readiness, and the frontend's proxied repository-list request returned 200. Backend lint, typecheck, build, and 73 tests passed; one Neo4j integration test was skipped. Frontend lint, typecheck, and build passed, but its test suite had 31 failures and 17 passes.

Deployment is not verified. The root `compose.yaml` still references `backend/dist/worker.js`; use the backend-only template in `backend/compose.yaml`, which runs the worker inside the API process. The container build, target-server deployment, backup restoration, hosted monitoring, and production access controls remain outstanding.
