# Architecture decisions

## 001 Single repository

Use npm workspaces with frontend and backend folders. The backend API and indexing worker currently run in one Node process. The root `npm run dev` command runs both workspace `dev` scripts in parallel using npm itself. Do not add a root launcher dependency or introduce microservices without a demonstrated need.

## 002 Backend data and workflow

Neo4j stores repository graphs, chunks, embeddings, jobs, and application records. Retrieval combines exact, full-text, vector, and bounded relationship search. LangGraph.js orchestrates the bounded question workflow. PostgreSQL, Redis, and repository code execution are out of scope.

## 003 Language and model boundaries

Use TypeScript on Node.js 24 LTS. Analyze JavaScript/TypeScript with the compiler API and Python with Tree-sitter WASM inside Node. Use Voyage code embeddings with model and dimensions configured together, and Groq for answers. The root engine range documents Node/npm requirements; `.nvmrc` has been removed. The shared TypeScript config does not set `strict: true`.

## 004 Local development without credentials

Allow the shell to start without external credentials so frontend and backend development can proceed. Liveness can pass, but readiness returns 503 until credentials, database connectivity, migrations, and worker heartbeat are healthy. Readiness does not prove provider quota or answer quality. Health checks never make paid model requests; provider probes must be run explicitly.

## 005 Frontend and root workspace command

Use React with Vite, Ant Design v5 components, and SCSS. Keep runtime dependencies declared in the frontend or backend workspace manifests. The root manifest has workspace metadata and a `dev` script that invokes both workspaces with `npm run dev --workspaces --parallel`; there are no root dependencies or root launcher file.

## 006 Implementation and release boundaries

Superseded for embedding selection and index migration by decision 007 below.

The product supports public repositories only and has no user accounts, tenant ownership, or API bearer-token authentication. Origin checks and rate limits are not user authentication; keep non-local deployments restricted. Provider requests use native HTTP. Indexing retries transient failures with bounded exponential backoff; abandoned worker leases have bounded claims. Inactive snapshot cleanup is implemented with a configurable retention period and protects active snapshots and in-progress work. OpenTelemetry export remains unconfigured.

Code chunks follow symbol boundaries where possible and use bounded line windows for oversized symbols and file context. A local tokenizer packs evidence conservatively, and Groq input is bounded conservatively using UTF-8 byte lengths and additional framing reserves. Evidence and history are packed within byte budgets. There is no remote token-count preflight. Actual provider token usage is validated after completion; the shared conservative request bound plus maximum output is reserved against daily answer budgets before generation.

Neo4j Community Edition can run locally through the optional database compose file. AuraDB Free is also supported by configuration; neither option requires changing the application storage adapter. The application staging compose file assumes an external database.

## 007 Voyage code embeddings and independent providers

Use Voyage voyage-code-4 at 1024 dimensions for code and question embeddings. Use Groq for answers with GROQ_API_KEY and GROQ_ANSWER_MODEL. Both adapters use native HTTP without a provider SDK. The target chunk size is 500 to 1000 estimated tokens with a 1500-token ceiling including metadata. Keep small symbols intact, prefer syntax boundaries for large symbols, and retain 50 to 100 tokens of overlap only when splitting symbols. Details are in embedding-policy.md.

Use additive generation-specific Neo4j labels and vector indexes instead of changing the old index in place. Cache and snapshot identities include provider, model, dimension and context-chunk policy. Existing data is preserved. A repository must be refreshed into the selected generation before search; identical commits alone do not establish embedding compatibility.


## 008 Groq answer generation

AI_PROVIDER is fixed to groq and EMBEDDING_PROVIDER to voyage. The default answer model is qwen/qwen3.8-27b. The Groq adapter sends chat completions with strict JSON schema output, validates usage and output, and rejects malformed, refused or incomplete answers. A 60-second deadline bounds each request, responses are capped at 4 MiB, redirects are rejected and provider bodies never enter client errors. No provider SDK or automatic retries are used. The Groq API URL contains a compatibility path named openai; it contacts only api.groq.com, using the Groq key. Provider credentials are backend-only.

References: https://console.groq.com/docs/structured-outputs and https://console.groq.com/docs/api-reference

## 009 MERN and Python profile support

Use the existing TypeScript compiler for JS, TS, JSX and TSX, with a virtual module resolver for local CommonJS imports and literal nearest-project path mappings. Extract inline route callbacks as separate symbols and add client/server context to embedding inputs. Include selected dependency manifests as data.

Use @vscode/tree-sitter-wasm 0.3.1 for Python syntax parsing inside the Node backend. This adds about 22 MiB of installed parser assets and no Python service. Parse local imports, lexical calls and known self/cls methods conservatively. Never import a repository module. Keep decorators in source chunks and report unresolved dispatch rather than inventing runtime framework links.

Snapshot readiness now checks mern-python-v1. Refresh is required after parser changes; vector configuration is unchanged and contextual hashes govern cache reuse. Public examples fill the URL field without starting indexing. EMBEDDING_BATCH_SIZE and EMBEDDING_BATCH_DELAY_MS are account-level tuning controls, not promises of an unlimited free tier.

Reference: https://github.com/microsoft/vscode-tree-sitter-wasm
