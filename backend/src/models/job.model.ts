export type Stage =
  | "QUEUED"
  | "FETCHING"
  | "PARSING"
  | "EMBEDDING"
  | "VERIFYING"
  | "READY"
  | "FAILED"
  | "CANCELLED";

export interface Job {
  id: string;
  repoId: string;
  status: Stage;
  commit: string;
  snapshotId: string;
  files: number;
  chunks: number;
  completedChunks: number;
  warnings: string[];
  error: string;
  createdAt: number;
  updatedAt: number;
  attempt: number;
  leaseOwner: string;
  leaseUntil: number;
  nextAttemptAt: number;
}
