# Supported repository profiles

The application targets MERN JavaScript/TypeScript projects and Python web applications. These profiles describe implemented static analysis, not a guarantee that every framework behavior can be resolved. Public repositories are downloaded at a pinned commit; their scripts, imports, installers and application code are never executed.

## MERN

The TypeScript compiler analyzes JavaScript, TypeScript, JSX and TSX. Function and class identities include file, scope and source span. React components and hooks remain source symbols. Express inline callbacks receive their own source chunks, including the route call context. CommonJS require statements and ES module imports create local file links when resolvable. MongoDB driver and Mongoose code is indexed as source; no database queries are executed.

Literal baseUrl and paths mappings from the nearest checked-in tsconfig or jsconfig are resolved against the downloaded virtual filesystem. Client and server can use separate alias maps. Configuration files are parsed as data. Extended configuration chains, runtime resolvers, dependency injection, dynamic imports and installed external type declarations are not loaded. Runtime call relationships may therefore remain unresolved.

Common client, frontend, components, pages and hooks folders receive frontend context. Backend, server, routes, controllers, middleware and model folders receive backend context. package.json, TypeScript configuration and README files supply dependency and architecture evidence. Lockfiles, dependency folders, generated bundles and environment files are excluded.

## Python

A pinned Microsoft Tree-sitter WASM runtime parses Python syntax inside the Node backend. No Python interpreter or project dependency installation is required. The parser extracts functions, async functions, classes, methods, decorator source and exact line citations. It links local absolute/relative imports, imported aliases, straightforward lexical calls and known self/cls method calls. Ambiguous object dispatch and external packages remain unresolved. Syntax errors are reported as coverage warnings.

pyproject.toml, requirements text files and Pipfile are included as source context. Virtual environments, site-packages, Python caches and likely credential files are excluded. Flask and FastAPI decorators are retained as source evidence; their runtime route registration and injected dependencies are not simulated. HTML/CSS templates, notebook cells and SQL execution are outside the current parser scope.

## Settings

| Backend environment field | Default | Purpose |
|---|---|---|
| MAX_SOURCE_FILES | 1000 | Maximum supported source/configuration files per repository |
| MAX_REPOSITORY_BYTES | 52428800 | Compressed download ceiling |
| MAX_EMBEDDING_TOKENS_PER_JOB | 200000 | Local estimated indexing token budget |
| EMBEDDING_BATCH_SIZE | 16 | Documents per embedding request, configurable from 1 to 16 |
| EMBEDDING_BATCH_DELAY_MS | 0 | Optional delay between uncached indexing batches, up to 60000 ms |
| MAX_EVIDENCE_BYTES | 14000 | Conservative byte budget for question evidence, configurable from 2000 to 14000 |
| MAX_OUTPUT_TOKENS | 4000 | Answer output ceiling; lower for small provider limits |

Account limits vary. Use the rate limits shown in the provider account rather than assuming the free tier is unlimited. A pacing delay still counts toward the ten-minute indexing deadline. Failed or uncertain requests retain token reservations; successful embedding checkpoints can be reused after an explicit refresh. Do not increase budgets merely to hide repeated provider failures.

The parser generation is mern-python-v1. Refresh previously indexed repositories to obtain Python support, project metadata and new import resolution, even when their commits have not changed. Stored citations for retained snapshots remain pinned to their original commits.

## Public examples

The page's Use example buttons fill the URL field; they do not make provider calls until Index repository is clicked.

- MERN CRUD app: https://github.com/mongodb-developer/mern-stack-example
- Python Flask app: https://github.com/miguelgrinberg/flasky
- Larger React and Python template: https://github.com/fastapi/full-stack-fastapi-template

Live static checks downloaded the first two examples without executing their code. MERN: 24 files, 59 symbols, 19 resolved static relationships. Flasky: 41 files, 262 symbols, 218 resolved static relationships. These checks establish parsing coverage, not production answer quality or complete framework semantics. The larger template is a suggested example and has not been fully indexed in this verification.


The default embedding batch size is 16 and the default inter-batch delay is 0 ms; tune `EMBEDDING_BATCH_SIZE` and `EMBEDDING_BATCH_DELAY_MS` to match the provider account's current limits. Smaller evidence and answer-output limits can reduce request sizes, but do not remove account quotas. A pacing delay counts toward the indexing deadline.
