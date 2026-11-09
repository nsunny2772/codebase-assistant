export const commonStrings = {
  SERVICE_NOT_CONFIGURED:
    "Configure Neo4j and the selected embedding provider in backend/.env and restart the application.",
  REPOSITORY_NOT_FOUND: "Repository not found.",
  JOB_NOT_FOUND: "Job not found.",
  REQUEST_FAILED: "Request failed",
  DEADLINE_EXCEEDED:
    "The operation exceeded its deadline. Try a narrower request.",
  DATABASE_UNAVAILABLE:
    "The repository database is unavailable or its indexes are not initialized.",
  INTERNAL_ERROR: "An internal error occurred.",
  INVALID_REQUEST: "The request could not be accepted.",
  ORIGIN_DENIED: "Origin is not permitted.",
  WORKER_IDLE:
    "Indexing worker idle: configure backend/.env and restart to enable indexing.",
  WORKER_HEARTBEAT_FAILED:
    "Worker heartbeat update failed; readiness may become unhealthy.",
  SNAPSHOT_CLEANUP_FAILED: "Inactive snapshot cleanup failed.",
  WORKER_READY: "Indexing worker ready.",
  WORKER_ITERATION_FAILED:
    "Worker iteration failed; retrying after a short delay.",
  REQUEST_COMPLETE: "API request completed",
  DB_MIGRATIONS_READY: "Database migrations and search indexes are ready.",
  DB_INITIALIZATION_FAILED:
    "Database initialization failed. Check credentials, schema privileges, and embedding generation.",
  MIGRATION_LOCKED:
    "Another process is applying database migrations. Retry startup shortly.",
  MIGRATION_LOCK_LOST:
    "Database migration ownership expired. Retry the migration command.",
  BACKEND_STARTUP_FAILED:
    "Backend startup failed ({code}). Check configuration fields and port availability.",
  BACKEND_PROCESS_FAILED: "Backend API process failed to start: {message}",
  WORKER_PROCESS_FAILED: "Worker process failed to start ({code})",
  WORKER_EXITED: "Worker exited ({reason})",
  INVALID_CONFIG_FIELDS: "Invalid configuration fields:",
  BACKEND_STARTUP: "Backend startup failed ({code}). Check configuration fields and port availability.",
  DATABASE_NOT_CONFIGURED: "Database not configured",
  WORKER_STARTUP_FAILED:
    "Worker startup failed ({code}). Verify database configuration, schema privileges and index generation.",
} as const;
