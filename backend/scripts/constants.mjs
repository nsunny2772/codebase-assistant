export const scriptStrings = {
  DATABASE_READY: "Database migrations and search indexes are ready.",
  DATABASE_INIT_FAILED:
    "Database initialization failed. Check credentials, schema privileges, and embedding generation.",
  BACKEND_START_FAILED: (message) => `Backend API process failed to start: ${message}`,
};
