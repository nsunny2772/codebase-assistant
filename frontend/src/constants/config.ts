import { JobStatus } from "@src/enums/JobStatus";

export const API_TIMEOUT_MS = 65000;
export const API_BASE_URL = "/v1";
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  JobStatus.READY,
  JobStatus.FAILED,
  JobStatus.CANCELLED,
];

export const HTTP_MAX_RETRIES = 2;
export const HTTP_RETRY_DELAY_MS = 500;
export const HTTP_MAX_RETRY_DELAY_MS = 10000;
export const JOB_POLL_INTERVAL_MS = 3000;
