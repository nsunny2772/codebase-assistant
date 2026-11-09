FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/package.json
# npm workspaces resolves all declared workspace manifests during npm ci.
# The frontend manifest is metadata only; its source and dependencies are not copied.
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace backend --ignore-scripts
COPY backend/ backend/
RUN npm run build -w backend

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
# Keep the root workspace installable without installing the frontend workspace.
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev --workspace backend && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3001/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/server.js"]
