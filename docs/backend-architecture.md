# Backend architecture

The backend is a Node.js 24 and TypeScript Express application. It provides the JSON API and starts the indexing worker in the same process. Repository code is downloaded and statically analyzed; it is never installed or executed.

## Request flow

```text
Express route → controller → service → repository → Neo4j
                      │          ├→ Groq / Voyage adapters
                      │          └→ analysis, ingestion, retrieval, LangGraph workflow
                      └→ API response serialization
```

Routes bind paths, Yup validation, and named controller methods. Controllers translate HTTP requests and responses, call injected services, and propagate client disconnects for answer requests. Services contain application rules and coordinate provider, analysis, retrieval, and persistence operations. Repositories encapsulate Neo4j queries and mapping. `Store` is the persistence contract used by services and tests.

## Source layout

```text
backend/src/
  app.ts                         Express composition and dependency wiring
  server.ts                      HTTP startup and in-process indexing worker
  config/index.ts                Environment schema and provider configuration
  connection/neo4j.connection.ts Neo4j driver construction
  constants/                     Backend messages and bounded policies
  controllers/                   Repository, job, question, and system handlers
  middlewares/                   API access/origin, validation, errors, request logs
  migrations/                    Ordered, restart-safe Neo4j schema migrations
  models/                        Domain types for repositories, jobs, chunks, answers
  repositories/                  Store contract and Neo4j query implementations
  routes/                        Express routes, HTTP types, OpenAPI, JSON serialization
  services/
    analysis/                    JavaScript/TypeScript and Python static analysis
    ingestion/                   Public GitHub retrieval and durable indexing
    retrieval/                    Bounded evidence packing
    workflow/                    LangGraph answer flow
    *.service.ts                 Repository, job, question, and system logic
    groq.ts, voyage.ts            Native HTTP provider adapters
    indexing-worker.service.ts    In-process worker, heartbeat, retries, retention
  utils/                         Errors, hashing, and Winston wrapper
  validations/                   Yup request schemas and repository URL validation
```

Controller exports (`RepositoryController`, `JobController`, `QuestionController`, and `SystemController`) receive their service dependencies and return specifically named route handlers. The dependency-binding function is retained for composition and tests; controllers do not open database connections or construct provider clients.

## Storage and migrations

Neo4j is the only application database. It stores repository and snapshot metadata, symbols, code chunks, embeddings, relationships, durable jobs, worker heartbeats, budget counters, and conversation records. The Neo4j repositories group query behavior by jobs, indexing, search, conversation, capacity, and budget while sharing the `Store` contract.

Numbered migrations are applied by the worker at startup and recorded in Neo4j. `npm run db:migrate -w backend` can apply pending migrations explicitly. Migrations must be safe to retry after partial completion. See [migration notes](../backend/src/migrations/README.md).

## Reliability and boundaries

- Liveness reflects whether the HTTP process is running. Readiness separately checks required credentials, database connectivity, applied migrations, and a recent worker heartbeat.
- Indexing retries are bounded, use exponential backoff, and apply only to transient failures. Active snapshots remain available until a replacement is fully indexed and activated.
- Inactive snapshot retention is configurable. Cleanup protects active snapshots, leased reads, and in-progress operations.
- API rate limiting, origin checks, request validation, safe error responses, request IDs, and structured Winston logs are centralized in middleware.
- API JSON uses snake_case. `routes/serializers.ts` maps camelCase property names recursively; Serializr is used only by the frontend.
- LangGraph.js orchestrates a bounded retrieval workflow. It is not the repository graph store; Neo4j stores code relationships and vector/full-text indexes.
- No Redis, PostgreSQL, TypeORM, Python server, or separate worker executable is required by the local npm workspace setup.

## Checks and deployment status

Run `npm run check -w backend` for lint, typecheck, tests, and build. The Neo4j integration test is skipped unless its dedicated test database is configured. On 10 November 2026, 73 backend tests passed and one Neo4j integration test was skipped; backend lint, typecheck, and build passed.

Deployment is unverified. The root `compose.yaml` still references the removed `backend/dist/worker.js` worker command. A backend-only Dockerfile and Compose template are available at `backend/Dockerfile` and `backend/compose.yaml`; that template runs the API and in-process worker together. It still needs a successful image build and target-server deployment check; see [deployment.md](deployment.md).
