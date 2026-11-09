export const indexingStrings = {
  WARNING_UNAVAILABLE: "Analysis warning unavailable.",
  READY_NO_CHANGES: "Repository ready · no new chunks embedded in this run.",
  STOPPED: (error: string) =>
    `Indexing stopped: ${error}. You can refresh to retry.`,
  WARNINGS: (count: number) => `Indexing warnings (${count})`,
  FILE_SUMMARY: (files: number, chunks: number) =>
    `Indexed files (${files}) · ${chunks} chunks`,
  FILE_CHUNKS: (embedded: number, total: number) =>
    `${embedded}/${total} embedded`,
  CANCEL: "Cancel indexing",
  PROGRESS: (files: number, complete: number, total: number) =>
    `${files} files · ${complete}/${total} chunks embedded`,
} as const;
