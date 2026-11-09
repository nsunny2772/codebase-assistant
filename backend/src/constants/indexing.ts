export const indexingStrings = {
  SNAPSHOT_UNAVAILABLE: "Snapshot is no longer available.",
  SNAPSHOT_UNAVAILABLE_SHORT: "Snapshot no longer available.",
  INCOMPLETE_SNAPSHOT: "Snapshot is incomplete.",
  CHUNK_LIMIT: "Repository exceeds the chunk limit.",
  CHUNK_TOKEN_LIMIT: "Code chunk exceeds the embedding token budget.",
  EMBEDDING_TOKEN_LIMIT: "Repository exceeds the embedding token budget.",
  NO_CHUNKS: "No usable code chunks were extracted.",
  CHUNK_TOO_LARGE: "Repository exceeds the chunk limit.",
  PARSER_TIMEOUT: "A Python file exceeded its parse time limit.",
  JOB_BUDGET: "Repository exceeds the embedding token budget.",
  QUEUE_FULL: "Indexing queue is full. Try again later.",
  LEASE_LOST: "Job ownership expired or the job was cancelled.",
  DAILY_BUDGET: "Daily provider token budget exhausted. Try again tomorrow.",
  GRAPH_CAPACITY:
    "Indexing would exceed the configured graph capacity. Delete older repositories or increase the database capacity.",
  MIGRATION_INDEX_DIMENSION_MISMATCH:
    "The vector index dimensions do not match backend configuration.",
  MIGRATION_INDEX_GENERATION_MISMATCH:
    "Embedding configuration differs from the database index generation. Migrate the index before starting.",
  UNRESOLVED_CALL_SITES: (count: number) =>
    `${count} call sites could not be resolved statically.`,
  FILE_CONTEXT_LABEL: (file: string) => `File: ${file}`,
  SYMBOL_CONTEXT_LABEL: (symbol: string) => `Symbol: ${symbol}`,
  SIGNATURE_CONTEXT_LABEL: (signature: string) => `Signature: ${signature}`,
} as const;
