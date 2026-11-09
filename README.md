# AI Codebase Assistant

AI Codebase Assistant indexes public GitHub repositories and answers questions using source-backed retrieval. The repository is a single npm-workspace project with a React/Vite frontend and a Node.js/TypeScript/Express backend. Neo4j stores repository metadata, indexed code, embeddings, graph links, jobs, and conversation records. LangGraph.js runs the bounded retrieval workflow; Groq generates answers and Voyage AI creates code embeddings.

Repository source is analyzed statically. The application does not install dependencies or execute submitted code. Private repositories and GitHub access tokens are not supported.

For a backend-only Docker deployment, see [docs/deployment.md](docs/deployment.md). The deployment template runs the Express API and indexing worker together and expects an external Neo4j database.

## Local development

Requirements are Node.js 24 and npm 11, as declared in the root `package.json` engines. There is no `.nvmrc` file. From the repository root:

```bash
npm ci
cp backend/.env.example backend/.env
npm run dev
```

The root `dev` script runs the frontend and backend workspace `dev` scripts in parallel, using npm workspaces without a separate launcher package. Open <http://127.0.0.1:5173>. Vite proxies `/v1` and `/health` to the backend, which defaults to port 3001. The backend also runs the indexing worker in its process.

The apps can start with no provider or database credentials, but repository operations will be unavailable and `/health/ready` will report not ready. Add `VOYAGE_API_KEY`, `GROQ_API_KEY`, `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` to `backend/.env` for indexing and answers. Provider keys stay in the backend environment; never add them to frontend variables or commit `.env` files.

The default answer provider is Groq (`qwen/qwen3.8-27b`). Embeddings use Voyage `voyage-code-4` at 1024 dimensions. Neo4j is the only application database. `compose.neo4j.yaml` is an optional local Neo4j Community setup; deployment compose files are unverified and are not required for local development.

## Commands

```bash
npm run dev
npm run lint -w backend
npm run typecheck -w backend
npm run test -w backend
npm run build -w backend
npm run check -w frontend
npm run check -w backend
```

`npm run check` in each workspace runs lint, typecheck, tests, and build. The shared `tsconfig.base.json` does not enable TypeScript's `strict` option; `noUncheckedIndexedAccess` remains enabled.

## How indexing and answers work

The backend fetches the public repository's default branch at a pinned commit, analyzes supported source/configuration files, stores symbol/chunk relationships and embeddings in Neo4j, and publishes a snapshot only after indexing succeeds. In-progress jobs are durable; progress is fetched through the API every three seconds. Transient indexing errors receive bounded retries. Inactive snapshots are subject to the configured retention policy; active snapshots and in-progress work are protected.

Chunking targets 500–1,000 locally estimated tokens, with a 1,500-token maximum including context. Large symbols split near syntax boundaries and use up to 100 tokens of overlap; small functions stay intact. Retrieval combines exact, full-text, vector, and bounded graph evidence. Answers use immutable commit citations and state static-analysis limitations. Citation checks validate source references, not the factual quality of every generated claim.

Supported analysis profiles cover JavaScript, TypeScript, JSX, TSX, Markdown, and Python web repositories. Python parsing uses Tree-sitter WASM inside Node. See [supported repositories](docs/supported-repositories.md) and [embedding policy](docs/embedding-policy.md) for exact limits.

## Project structure

```text
frontend/src/       React views, components, services, models, routes, and tests
backend/src/        Express API, controllers, services, Neo4j repositories, and worker logic
backend/tests/      Backend unit, API, and optional Neo4j integration tests
frontend/src/tests/ Frontend interaction, model, service, and interceptor tests
docs/               Architecture, API, operations, and implementation records
```

The backend uses routes → controllers → services → repositories/models. The frontend uses React Query, Axios, React Hook Form, Yup, Ant Design v5, SCSS modules, and Serializr for frontend request/response models. Backend JSON responses use a small snake_case serializer; the backend does not use Serializr.

See [backend architecture](docs/backend-architecture.md), [frontend conventions](docs/frontend.md), [API](docs/api.md), [operations](docs/operations.md), and the [implementation tracker](docs/implementation-tracker.md).

## Current verification

On 10 November 2026, local backend lint, typecheck, build, and 73 tests passed; one Neo4j integration test was skipped. Frontend lint, typecheck, and production build passed, but the frontend test suite had 31 failures and 17 passes. The frontend build also reports a large JavaScript chunk. The local API returned 200 for liveness, readiness, and the proxied repository-list request. These checks do not establish live provider answer quality or deployment readiness; see the tracker for details.

