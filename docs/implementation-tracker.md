# Implementation tracker

Update this file after each verified milestone. Completed means its exit checks passed; blocked tasks remain visible. No production functionality is implied by project scaffolding.

The table and latest verification below describe the current state. Entries under historical verification record earlier project states; newer decisions and the latest verification supersede them.

| Step | Deliverable | Status | Evidence or blocker |
|---|---|---|---|
| 1 | Project baseline and compatibility checks | Local setup, Neo4j and Voyage checks completed | Neo4j authentication and vector/full-text search passed on Aura 5.27; live Voyage embedding request passed at 1024 dimensions |
| 2 | Parser and symbol resolution | Completed within documented MERN/Python static-analysis scope | Duplicate names, aliases, overloads, arrows, unresolved calls and syntax fixtures pass; public repository parser smoke passed |
| 3 | Durable GitHub ingestion | Implemented; scoped live recovery checks passed | Bounded archive download, public-only metadata, job states, leases, cancellation and embedding checkpoints; fixture and real GitHub download checks pass |
| 4 | Graph storage and searchable chunks | Scoped live storage and contention checks passed | Voyage-generation schema, 1024-dimensional synthetic vector retrieval, activation and scope checks passed; full integration suite still needs a disposable server |
| 5 | Hybrid retrieval | Implemented; retrieval-quality gate pending | Exact, full-text, vector, rank fusion, scoped traversal and symbol lookup; real recall evaluation not run |
| 6 | Grounded answers and citations | Live HTTP answer smoke passed; broader quality evaluation pending | Structured output, citation validation, abstention, provider error handling and immutable commit URLs tested with fake provider transport |
| 7 | Bounded LangGraph investigation | Implemented and locally tested; live Groq smoke check passed | Retrieval rounds, recursion limit, token packing, conservative context preflight, history cap, deadlines and daily token reservations |
| 8 | Refresh and deletion | Live lifecycle and fault checks passed | Failed updates retain active snapshots; retained-snapshot citations stay on original commit; scoped deletion and reconnectable jobs |
| 9 | Minimal repository frontend | Implemented; frontend automated tests currently failing | React, Vite, Ant Design v5, SCSS, submission, progress, cancellation, refresh, deletion, capacity display, chat and citations; latest suite has 31 failures |
| 10 | Reliability and staging | Local reliability implemented; deployment deferred | Readiness, worker heartbeat, bounded transient indexing retries, snapshot retention, origin checks, rate limits, safe logs, and token budgets; authentication, containers, and restore drill unverified |
| 11 | Evaluation and pilot release | Deferred / blocked | Evaluation harness and dataset are not part of the current implementation; answer-quality gates, load measurements, and hosted pilot are incomplete |
| 12 | Pilot fixes and version one verification | Blocked | Requires real pilot results and successful release gates; no production-readiness claim |

## Latest verification on 10 November 2026

- Backend `npm run check -w backend` passed: lint, typecheck, build, and 73 tests passed; one Neo4j integration test was skipped.
- Frontend lint, typecheck, and production build passed. `npm run check -w frontend` failed in its test stage: 31 tests failed, 17 passed, with two unhandled errors. Fix or update the tests before claiming the frontend suite passes.
- The frontend build reports a JavaScript chunk above Vite's 500 kB advisory threshold.
- Local runtime checks passed: `/health/live`, `/health/ready`, and the frontend-proxied `/v1/repositories` returned HTTP 200. This verified local backend readiness and a repository-list read, not model answer quality.
- No live LLM question was submitted during this check. Production deployment remains deferred and unverified.

## Historical verification on 3 November 2026

- Frontend uses React, Vite, Ant Design v5 and SCSS; root dependencies remain empty.
- Backend uses TypeScript, Express, LangGraph, Neo4j, native Groq HTTP for answers and Voyage for embeddings.
- Local checks pass: 54 backend tests and 5 frontend tests, lint, type checks and builds. The disposable Neo4j integration suite remains skipped without TEST_NEO4J_URI.
- Neo4j authentication, full-text/vector compatibility and scoped storage probes passed. Synthetic vectors validate persistence and scope, not semantic quality.
- Public GitHub ingestion and parsing passed on a small repository without executing its code.
- Code chunks target 500 to 1000 estimated tokens, with a 1500-token ceiling and 50 to 100-token overlap only across split oversized symbols.
- Groq adapter tests cover native Groq requests, structured output, token preflight, context limits, missing credentials, malformed/refused/incomplete output and safe billing/auth/rate errors.
- Environment files contain only the active provider settings; secret values are never printed. Voyage embeddings and Groq structured-answer checks pass with configured credentials.
- All application adapters, configuration and documentation use only the selected providers. LangGraph's upstream dependency metadata lists an optional unrelated provider integration; its SDK is not installed or used.
- Staging, hosted CI, restore drills, latency and answer-quality evaluation remain unverified.

## Remaining release evidence

| Gate | Status | Required action |
|---|---|---|
| Actual Neo4j authentication, schema, search and transaction suite | Scoped checks passed; full suite pending | Live authentication, indexes, activation and scoped retrieval passed; contention/restart tests still need a disposable database |
| Actual model embeddings and structured answer smoke checks | Passed | Voyage returned 1024 dimensions; Groq strict JSON and evidence-free abstention passed |
| Source-supported answer and retrieval quality | Pending | Review 60 repository questions, hold out 20, run live evaluation and assess claims |
| Workload latency and indexing throughput | Pending | Measure the documented pilot workload on the selected host |
| Docker images and HTTPS staging | Blocked | Deferred by user; not part of current local validation |
| Backup restore and rollback drill | Pending | Run against the selected Neo4j deployment and record outcomes |
| Hosted CI execution | Pending | Deferred with deployment; local equivalents pass |
| Multi-user isolation | Not implemented | There are no user accounts, tenant ownership, or API user authentication; do not expose a public multi-user service |

## Working rules

- Add verification results and relevant commands before marking completed.
- Keep repository analysis read-only; never execute submitted project code.
- Keep frontend in frontend/src and all backend and worker code in backend/src.
- Credential values never belong in this tracker, logs, frontend variables, or commits.
- Run live checks explicitly because the embedding check makes a small paid API request.

## Current implementation notes

- The root `npm run dev` invokes frontend and backend workspace scripts in parallel through npm. The root manifest has no dependencies and no separate launcher file.
- The API and indexing worker run in the same backend process. The root Compose file still references removed `backend/dist/worker.js`; a backend-only Dockerfile and Compose template have been added, but image build and server deployment are unverified. See [deployment.md](deployment.md).
- Serializr is used by the frontend only. Backend JSON responses use the local snake_case response mapper.
- The shared TypeScript configuration no longer sets `strict: true`; `noUncheckedIndexedAccess` remains enabled.

Live connection recheck: Neo4j authenticated read and Voyage embeddings passed. The Groq check passed with qwen/qwen3.8-27b: 157 input tokens and 55 output tokens, valid structured JSON and correct evidence-free abstention. This is a transport/schema smoke check, not repository answer-quality validation. Backend lint, type checking, 54 tests and build pass; one disposable database test remains skipped. The previous 5 frontend tests passed; no frontend files changed in this provider migration.

## Local verification and profile expansion

- Deployment, hosted CI and infrastructure backup/restore drills are deferred by the user's explicit request. They are not marked completed.
- Live HTTP workflow passed eight checks: readiness, submission, GitHub/Voyage indexing, Groq answer with pinned citations, cross-snapshot rejection, unchanged refresh, cancellation and complete repository/conversation deletion. Indexing took 14.1 seconds on a small library; the answer took 5.8 seconds. This is one smoke sample, not p95 answer latency.
- Nine scoped real-Neo4j reliability checks passed: submission deduplication, competing worker claims, reconnection, lease fencing, failed refresh preservation, successful changed-commit retry, retained snapshot commit, cancellation, retry exhaustion and resumable deletion (some assertions share a check). Temporary records were removed and the development worker was resumed.
- HTTP read workload: 40 requests at concurrency five, all 200 responses, p50 203 ms and p95 610 ms. Rate limiting was enforced. A 1000-file synthetic parser workload completed in 694 ms; this excludes embeddings, downloads and database writes.
- Evaluation exposed a renamed GitHub repository and documentation crowding. Added bounded same-origin GitHub redirects, transport-error classification, and distinct-file evidence packing with regression tests. The rerun achieved 100 percent expected-path recall for 15 answerable questions on one small library. The full 60-question run and answer-quality review remain incomplete because live providers returned rate/configuration errors. No release-quality pass is claimed.
- Added Python Tree-sitter AST parsing, functions/classes/decorators, conservative local import/call resolution and source-accurate chunks. Added MERN aliases, CommonJS import edges, Express callback chunks, project manifests, client/server context and virtual-environment exclusions.
- Real public MERN and Flask repositories passed static parser checks. Details and limits are documented in supported-repositories.md. The frontend lists supported stacks and three URL-fill examples; clicking an example does not start provider work.
- Added an analysis-version check so existing repositories require refresh after parser changes. Old retained snapshot commits remain available for citations.

Final local profile checks: 66 backend tests and 7 frontend tests pass, with the disposable Neo4j integration suite still skipped. Both workspaces pass lint, type checks and builds. No deployment was attempted.

Live MERN profile indexing passed: mongodb-developer/mern-stack-example completed 64 chunks in approximately 101 seconds with paced embedding batches. The known-answer request was blocked by PROVIDER_LIMIT. The Python profile indexing check is recorded separately when complete.

The first Python live indexing attempt reached 240 of 273 chunks before a Voyage rate limit. Cached successful embeddings were retained. The subsequent index-only retry does not call Groq and reports indexing separately from answer quality.

## Frontend structure

Historical frontend reorganization note: the current test setup is under `frontend/src/tests`, React hooks are under `frontend/src/hooks`, and page views are under `frontend/src/views`. The structure has since changed; see [frontend.md](frontend.md) for the current layout. Manual browser and screenshot checks are not part of the current verification workflow.

The index-only retry completed successfully: both mongodb-developer/mern-stack-example (64 chunks) and miguelgrinberg/flasky (273 chunks) have active snapshots using mern-python-v1. Python reused 240 cached embeddings; the successful retry took approximately 159 seconds. This does not include the earlier interrupted attempt and is not a fresh-index throughput benchmark. No Groq requests were made during the retry. Both examples remain in the application. Groq answer-quality verification remains rate-limited.

Frontend restructuring passed seven home workflow tests, lint, type checking and production build. The latest backend checks passed 66 tests plus lint, type checking and build; one disposable database suite remains skipped. Manual screenshots are not required by the current workflow.

## Frontend services and reusable forms

- Added pinned TanStack React Query and React Hook Form dependencies in the frontend workspace only. The root manifest still has no dependencies.
- Moved HTTP operations to src/services. Queries handle repository/capacity data and fetch active-job status every three seconds; polling stops on terminal jobs or request errors. Mutations handle submission, refresh, cancellation, deletion and questions and never retry automatically.
- Historical behavior, later removed: the frontend once supported connection scopes and user-entered access tokens. The current application supports public repositories only and has no GitHub token input; see [frontend.md](frontend.md) and [api.md](api.md).
- Added shared Navbar, Button, Dropdown, Form, Input, RepositoryProgress and AnswerList components. Form wraps React Hook Form context; named dropdowns and inputs use controlled bindings with validation. Home uses separate connection, repository and question forms.
- Moved constants to src/constants and added src/enums/JobStatus.ts. API/UI types stay under src/types.
- Automated checks cover form validation/defaults, named-dropdown submission, job polling/completion, failed-read polling stops, query cancellation, mutation retry prevention, deletion cache removal and credential-cache isolation. No manual screenshots are used.

## Component folders and coding conventions

- All reusable components now have their own folder containing index.tsx, index.scss and colocated component tests. Global page utilities remain in assets/styles.scss.
- Converted frontend components, hooks and helpers to arrow functions. Grouped package imports, internal imports and style imports with blank lines, including a blank line before module code.
- Added ESLint checks for these function and import conventions. Kept constants and enums directly under src and all API code under services.
- Component tests cover safe button submission/loading, form-bound dropdown/input values and validation, immutable answer links, indexing cancellation and disabled public-example actions. Browser-like test workers are limited to two to avoid local resource timeouts.

Final frontend verification for this refactor: 23 tests across ten files pass, along with ESLint, TypeScript checks and the production build. Automated AST/folder checks found zero non-arrow function declarations and confirmed every shared component has index.tsx, index.scss and a colocated test. Backend runtime behavior was not changed by this frontend refactor.

## CSS modules, defensive UI and routes

- Extracted FieldError into its own shared component folder and reused it in inputs/dropdowns.
- Replaced component index.scss files with component-named .module.scss files, imported as styles. All component/page classes use module references; clsx combines classes. Global body defaults remain in assets/styles.scss.
- Replaced inline JSX functions with named handlers and render helpers. Added ESLint checks for named handlers, CSS-module imports and nonliteral class references.
- Added optional access and clear fallbacks for missing answer/citation metadata, HTTP error payloads, job fields and capacity values, while retaining explicit errors for missing required form context.
- Moved every cache/invalidation key definition to src/constants/QueryKey.ts. Added src/routes/index.tsx, Home at / and a not-found view, with centralized RoutePath enum values.
- Final automated verification: all 28 frontend tests pass across 12 files; lint, type checking and production build pass. Route navigation, standalone FieldError and incomplete-response fallbacks are covered. No manual browser or image checks were used.

## Backend MVC refactor

- Moved domain entities and Neo4j persistence to models and updated all backend, worker, script and test imports.
- Added repository/job/question/system controllers and application services. Controllers handle HTTP translation and request cancellation; services own application behavior and call models/workflows.
- Split route registration and validation schemas under routes. Extracted authorization/origin guards, safe error translation and request logging into middleware.
- React remains the view layer. API routes, response statuses, request validation, job lease redaction and database generation are preserved.
- Added controller disconnect propagation and listener-cleanup tests. Backend builds clear generated output before compilation to remove stale moved modules.
- Backend architecture details are documented in backend-architecture.md. No live embedding or answer requests were needed for this refactor.

MVC verification passed: 68 backend tests, lint, TypeScript checks and clean production build. The disposable Neo4j integration test remains skipped without its dedicated database. Existing API contract tests pass and controller cancellation/listener cleanup is tested.

## Page folders and nested Home route

- Home is a page folder at views/Home/index.tsx containing only Navbar and Outlet inside the page container. Its index route renders the Home-specific RepositoryWorkspace component.
- Moved repository-specific answers, progress and public-example UI, with their module styles and tests, from shared/components to views/Home/components. Reusable Navbar, Button, Dropdown, Form, Input and FieldError remain shared.
- NotFound is now its own page folder and renders through the same Home route outlet. Route tests verify index content, a single Navbar and return navigation from an unknown URL.
- At the time of this historical entry, `.nvmrc` remained. It was removed on 10 November 2026; the root `package.json` engines field is the current Node/npm compatibility declaration. Compose files remain unverified and are not used by `npm run dev`.
- Full frontend lint, type checking, 28 tests and production build pass. Verification remains automated only.

## Axios and service option factories — completed

- Added Axios to the frontend only. The shared client returns response.data, sends JSON using data, and preserves authorization, timeouts, query cancellation and useful HTTP/network errors.
- Services export queryOptions/mutationOptions through the default repositoryService object. Views call useQuery(repositoryService.list(context)) and useMutation(options.submit); services do not call React hooks.
- Preserved scoped query keys, job polling, completion invalidation, mutation cache updates and disabled automatic mutation retries.
- Updated automated HTTP fixtures and added real Axios adapter coverage. Frontend lint, type checks, all 31 tests and production build pass. No manual browser verification or live provider calls were used.

## Import alias and Serializr models — completed

- Configured @src in TypeScript, Vite and Vitest; replaced internal frontend imports with the alias. Styles retain local module imports and ESLint recognizes alias imports as internal.
- Added Serializr schemas for every JSON API response, nested answer evidence/usage, error messages and request bodies. Axios endpoints serialize outgoing bodies and deserialize incoming JSON; no-body operations keep their existing HTTP behavior.
- Added tests for nested model round trips, mapped properties, request body filtering, endpoint deserialization and 204 behavior.
- Verification passed: frontend lint, TypeScript, 35 tests and production build. Existing Vite bundle-size advisory remains. No manual browser checks or live AI requests were used.

## Global Axios interceptor — completed

- Added src/interceptor with the shared Axios instance, centralized error normalization and bounded read retry policy. Services retain endpoint calls and Serializr mapping.
- GET/HEAD transient failures receive at most two retries with exponential backoff/jitter. Retry-After is respected up to ten seconds; longer delays return the error without retrying early. Cancellation clears pending backoff.
- Writes, authentication failures and other non-transient errors are not retried. React Query retries remain disabled.
- Added real Axios adapter tests for eventual success, retry exhaustion, writes/authentication exclusion, Retry-After and cancellation during backoff.
- Frontend lint, TypeScript, 40 tests and production build pass. Existing bundle-size advisory remains; verification was automated only.

## Entity service objects without signal — completed

- Consolidated related repository endpoints, Serializr mapping and query/mutation options into services/repository.service.ts, exported as RepositoryService. Removed the old repositories/queries/mutations/repositoryApi modules and updated consumers.
- Views call useQuery(RepositoryService.list(context)) and useMutation(RepositoryService.submit(context)) directly. Service queries no longer receive or pass AbortSignal.
- Kept scoped keys, cache updates, polling, Axios timeout and bounded read retries. In-flight HTTP requests now finish independently of React Query cancellation.
- Updated service tests to assert requests omit signal. Frontend lint, TypeScript, 40 tests and production build pass; existing bundle-size advisory remains.

## Localhost origin rejection — fixed

- Vite's API proxy now preserves the frontend Host header (changeOrigin: false). Browser Origin and forwarded Host therefore match when opening either localhost:5173 or 127.0.0.1:5173.
- Retained backend origin restrictions. Added HTTP coverage for both local addresses and rejection of an unrelated origin.

## Repository library and duplicate-link flow — completed

- Added a Home-specific RepositoryLibrary with selectable repository cards, index availability, commit information and a separate question panel. Layout stacks on narrower screens.
- Before indexing, fetch the latest repository list and compare normalized GitHub identities. Existing links show Already indexed/Already added with open and reindex actions; failed lookups prevent new indexing requests.
- Both existing-link reindex and the selected repository's Reindex button require confirmation. Cancel keeps the existing index without a POST. Selection clears the old chat view.
- Automated verification: 13 Home workflow tests pass, including new indexing, normalized duplicates, reindex confirmation/cancellation, library selection and failed lookups. The remaining 32 frontend tests passed in the full run; lint, TypeScript and production build also checked. No browser screenshots or live provider calls were used.

## Full application shell and sidebar UX — completed

- Replaced the centered page/card library with a viewport-height app shell, compact Navbar and persistent desktop sidebar. Repository navigation has search, indexed/not-ready groups, selection indicators and scrollable results.
- Moved connection state, session token controls and graph usage to the sidebar footer. Narrow screens get an overlay sidebar with open/close controls and backdrop dismissal.
- Added an on-demand add-repository panel, collapsible examples, focused selected-repository header, bottom question composer and scrolling to new answers. Removed the duplicate repository dropdown.
- Both reindex and delete use controlled confirmation dialogs. Existing duplicate-link checks and open-without-reindexing behavior remain.
- Verification passed: 48 frontend tests, lint, TypeScript and production build. Added automated sidebar search/panel navigation, mobile toggle and delete-cancel checks. No manual browser/image verification was used. The existing bundle-size advisory remains.
