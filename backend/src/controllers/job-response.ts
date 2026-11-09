import type { Job, Stage } from "../models/index.js";

export interface JobResponse {
  id: string;
  repoId: string;
  status: Stage;
  files: number;
  chunks: number;
  completedChunks: number;
  warnings: string[];
  error: string;
  snapshotId: string;
  commit: string;
}

export const toJobResponse = ({
  id,
  repoId,
  status,
  files,
  chunks,
  completedChunks,
  warnings,
  error,
  snapshotId,
  commit,
}: Job): JobResponse => ({
  id,
  repoId,
  status,
  files,
  chunks,
  completedChunks,
  warnings,
  error,
  snapshotId,
  commit,
});
