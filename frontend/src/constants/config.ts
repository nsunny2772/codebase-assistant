import { JobStatus } from "@src/enums/JobStatus";

export const API_TIMEOUT_MS = 65000;
const DEFAULT_API_BASE_URL = import.meta.env.DEV
  ? "/v1"
  : "https://codebase-assistant-backend-latest.onrender.com/v1";
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  JobStatus.READY,
  JobStatus.FAILED,
  JobStatus.CANCELLED,
];

export const HTTP_MAX_RETRIES = 2;
export const HTTP_RETRY_DELAY_MS = 500;
export const HTTP_MAX_RETRY_DELAY_MS = 10000;
export const JOB_POLL_INTERVAL_MS = 3000;
