export const QueryKey = {
  REPOSITORIES: ["repositories"] as const,
  CAPACITY: ["capacity"] as const,
  REPOSITORY: (id: string) => ["repository", id] as const,
  JOBS: (id: string) => ["repository", id, "jobs"] as const,
  CHUNKS: (id: string) => ["repository", id, "chunks"] as const,
} as const;
