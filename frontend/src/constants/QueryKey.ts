export const QueryKey = {
  REPOSITORIES: ["repositories"] as const,
  CAPACITY: ["capacity"] as const,
  REPOSITORY: (id: string) => ["repository", id] as const,
  JOBS: (id: string) => ["repository", id, "jobs"] as const,
  CHUNKS: (id: string) => ["repository", id, "chunks"] as const,
  EXPLORE_REPOSITORIES: (query: string, language: string, sort: string, page: number) =>
    ["explore", "repositories", query, language, sort, page] as const,
} as const;
