# Backend deployment with Docker

The backend can be deployed by itself with `backend/Dockerfile` and `backend/compose.yaml`. The image contains the Express API and the indexing worker in one Node process. It does not build or serve the React frontend, and it does not start Neo4j; configure an external Neo4j database.

## Prepare the server

Copy the repository to the server, then create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Set the Neo4j URI, username and password, `GROQ_API_KEY`, `VOYAGE_API_KEY`, and `PUBLIC_ORIGIN` in `backend/.env`. `PUBLIC_ORIGIN` must match the browser-facing frontend origin. Keep this file private and out of version control. Use a secret manager if the server has one.

The API currently has no user authentication or tenant ownership. Compose binds its port to `127.0.0.1:3001`, so put it behind a TLS reverse proxy and restrict access to trusted users. Do not publish port 3001 directly to the internet.

## Build and run

Run from the repository root:

```bash
docker compose -f backend/compose.yaml up -d --build
```

The Docker build context is the repository root because npm workspaces and the lockfile are at the root. The image installs only the backend workspace's production dependencies and compiles only `backend/src`; the frontend source and runtime are not included. The frontend package manifest is copied only because npm needs all workspace manifests to resolve the root lockfile.

Check the container and logs:

```bash
docker compose -f backend/compose.yaml ps
docker compose -f backend/compose.yaml logs -f api
curl http://127.0.0.1:3001/health/live
curl http://127.0.0.1:3001/health/ready
```

The container health check uses `/health/live`. Readiness also checks Neo4j migrations and the in-process indexing worker. Migrations are applied by the backend startup workflow. Indexing runs in the same container as the API, so do not start a separate worker container.

## Operations

- Persistent repository/index data lives in Neo4j, not in the container filesystem. Back up Neo4j independently.
- `docker compose ... up -d --build` rebuilds and replaces the container for an application update.
- The Compose service restarts after a process exit and allows 30 seconds for graceful shutdown.
- Set `PUBLIC_ORIGIN` to the frontend's public origin. If a reverse proxy serves both frontend and API from the same origin, set it to that origin.
- The Compose file binds to loopback intentionally. Configure the reverse proxy on the host to reach `127.0.0.1:3001` and terminate HTTPS.
- This is a backend-only deployment template, not a complete production release. Validate provider limits, Neo4j backups and restore, monitoring, TLS proxy configuration, and access controls for the target server.

The root `compose.yaml` remains a development template and still contains stale frontend/separate-worker configuration. Use `backend/compose.yaml` for this backend-only deployment.
