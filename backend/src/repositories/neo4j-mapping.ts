import type { Evidence, Job, Repo, Stage } from "../models/index.js";
import { AppError } from "../utils/app-error.js";

const invalidRecord = (): never => {
  throw new AppError(
    "DATABASE_RECORD_INVALID",
    "Stored repository data is invalid.",
    503,
  );
};

const stringField = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "string" ? value : invalidRecord();
};

const numberField = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : invalidRecord();
};

const optionalNumberField = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return value === undefined
    ? undefined
    : typeof value === "number" && Number.isFinite(value)
      ? value
      : invalidRecord();
};

const stages: Stage[] = [
  "QUEUED",
  "FETCHING",
  "PARSING",
  "EMBEDDING",
  "VERIFYING",
  "READY",
  "FAILED",
  "CANCELLED",
];

export const jobFrom = (record: Record<string, unknown>): Job => {
  const status = stringField(record, "status");

  const warnings = record.warnings ?? [];
  if (!stages.includes(status as Stage) || !Array.isArray(warnings))
    return invalidRecord();

  return {
    id: stringField(record, "id"),
    repoId: stringField(record, "repoId"),
    status: status as Stage,
    commit: stringField(record, "commit"),
    snapshotId: stringField(record, "snapshotId"),
    files: numberField(record, "files"),
    chunks: numberField(record, "chunks"),
    completedChunks: numberField(record, "completedChunks"),
    warnings: warnings.map((warning) =>
      typeof warning === "string" ? warning : invalidRecord(),
    ),
    error: stringField(record, "error"),
    createdAt: numberField(record, "createdAt"),
    updatedAt: numberField(record, "updatedAt"),
    attempt: numberField(record, "attempt"),
    leaseOwner: stringField(record, "leaseOwner"),
    leaseUntil: numberField(record, "leaseUntil"),
    nextAttemptAt: optionalNumberField(record, "nextAttemptAt") ?? 0,
  };
};

export const repoFrom = (record: Record<string, unknown>): Repo => {
  const deletedAt = optionalNumberField(record, "deletedAt");
  return {
    id: stringField(record, "id"),
    url: stringField(record, "url"),
    owner: stringField(record, "owner"),
    name: stringField(record, "name"),
    activeSnapshot: stringField(record, "activeSnapshot"),
    commit: stringField(record, "commit"),
    createdAt: numberField(record, "createdAt"),
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
};

export const chunkFrom = (
  record: Record<string, unknown>,
  score = 0,
): Evidence => ({
  id: stringField(record, "id"),
  snapshotId: stringField(record, "snapshotId"),
  symbolId: stringField(record, "symbolId"),
  path: stringField(record, "path"),
  name: stringField(record, "name"),
  startLine: numberField(record, "startLine"),
  endLine: numberField(record, "endLine"),
  text: stringField(record, "text"),
  contentHash: stringField(record, "contentHash"),
  ...(typeof record.embeddingText === "string"
    ? { embeddingText: record.embeddingText }
    : {}),
  ...(typeof record.context === "string" ? { context: record.context } : {}),
  score,
});
