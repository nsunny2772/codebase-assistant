export const API_ROUTES = {
  GET_REPOSITORIES: "/repositories",
  GET_CAPACITY: "/capacity",
  GET_EXPLORE_REPOSITORIES: "/explore/repositories",
  GET_REPOSITORY_JOBS: "/repositories/:repoId/jobs",
  GET_REPOSITORY_CHUNKS: "/repositories/:repoId/chunks",
  POST_REPOSITORIES: "/repositories",
  POST_REPOSITORY_REFRESH: "/repositories/:repoId/refresh",
  DELETE_REPOSITORY: "/repositories/:repoId",
  POST_CANCEL_JOB: "/jobs/:jobId/cancel",
  POST_REPOSITORY_QUESTIONS: "/repositories/:repoId/questions",
} as const;
