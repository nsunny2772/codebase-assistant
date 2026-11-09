# Backend API

`GET /v1/openapi.json` returns the OpenAPI contract. The frontend makes same-origin requests; Vite proxies `/v1` and `/health` to the backend during local development. API JSON uses snake_case. The backend supports public GitHub repositories only and does not accept GitHub access tokens.

| Method | Path | Behavior |
|---|---|---|
| GET | `/health/live` | HTTP process liveness; independent of worker availability |
| GET | `/health/ready` | Required configuration, Neo4j, migrations, and worker heartbeat readiness |
| GET | `/v1/openapi.json` | OpenAPI document |
| GET | `/v1/capabilities` | Supported languages, profiles, limits, provider configuration |
| GET | `/v1/capacity` | Graph counts and configured indexing limits |
| GET | `/v1/repositories` | Indexed public repositories |
| POST | `/v1/repositories` | Add a public repository and enqueue indexing; HTTP 202 |
| GET | `/v1/repositories/:id` | Repository metadata and active snapshot |
| GET | `/v1/repositories/:id/jobs` | Recent jobs for the repository |
| GET | `/v1/repositories/:id/chunks` | Per-file chunk and embedding counts |
| GET | `/v1/repositories/:id/symbols?name=validate` | Scoped symbol candidates |
| POST | `/v1/repositories/:id/refresh` | Queue reindexing; HTTP 202 |
| DELETE | `/v1/repositories/:id` | Cancel work and delete repository data; HTTP 204 |
| GET | `/v1/jobs/:id` | Job status and progress without worker lease details |
| POST | `/v1/jobs/:id/cancel` | Cancel a job; HTTP 204 |
| POST | `/v1/repositories/:id/questions` | Ask about a READY snapshot |

## Request and response shapes

Add a repository:

```json
{"url":"https://github.com/owner/repository"}
```

Ask a question:

```json
{"question":"How does login work?","conversation_id":"session-id","snapshot_id":"optional-ready-snapshot-id"}
```

`snapshot_id` is optional; when omitted, the active snapshot is used. Conversation records are scoped by repository and snapshot. Successful answer responses contain `run_id`, `snapshot_id`, `commit`, `answer`, `citations`, `limitations`, `abstained`, `retrieval_rounds`, and provider token usage. Citation links point to the indexed commit.

Errors contain a safe `code`, `message`, and `request_id`; `retryable` appears when applicable. Common statuses include 400 invalid input, 403 rejected origin, 404 missing resource, 409 state conflict, 413 configured size/token limit, 429 rate or budget limit, 503 missing/unavailable dependencies, and 504 deadline exceeded.

The API checks browser origins and applies process-level rate limits, but it does not authenticate users or enforce tenant ownership. There is no user-facing GitHub token or account system. Keep the service restricted to trusted users until authentication and ownership are designed.

Readiness is not a model-quality or provider-quota check. It verifies the backend configuration, Neo4j connectivity, migration state, and worker heartbeat without making provider calls.
