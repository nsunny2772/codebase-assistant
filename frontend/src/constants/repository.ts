export const repositoryStrings = {
  ADD_TITLE: "Add a repository",
  URL_PLACEHOLDER: "https://github.com/owner/repository",
  INDEX: "Index repository",
  ALREADY_INDEXED: "Already indexed",
  ALREADY_ADDED: "Repository already added",
  DUPLICATE_DESCRIPTION: (identity: string) =>
    `${identity} is already in your library. Open it or confirm reindexing.`,
  OPEN_EXISTING: "Open existing repository",
  REINDEX: "Reindex repository",
  EXPLORE_SAMPLES: "Explore a sample repository",
  SEARCH_LABEL: "Find a repository",
  SEARCH_PLACEHOLDER: "Search repositories…",
  INDEXED_HEADING: "INDEXED REPOSITORIES",
  NOT_READY_HEADING: "NOT READY",
  NO_MATCHING: "No matching repositories.",
  EMPTY_LIBRARY: "No repositories yet. Add one to start exploring.",
  REPOSITORY_UNAVAILABLE: "This repository is not in your library.",
  BACK_TO_REPOSITORIES: "Back to My Repos",
  DELETE_TITLE: (identity: string) => `Delete ${identity}?`,
  DELETE_DATA: "Delete indexed data",
  KEEP_REPOSITORY: "Keep repository",
  REINDEX_TITLE: (identity: string) => `Reindex ${identity}?`,
  KEEP_INDEX: "Keep existing index",
  DELETE_DESCRIPTION:
    "This removes indexed snapshots and stored conversations. The GitHub repository is unaffected.",
  REINDEX_DESCRIPTION:
    "Check GitHub for updates and index changed code. The existing index remains available. This may use embedding quota.",
  QUESTION_PLACEHOLDER: "How does authentication work?",
  QUESTION_HINT:
    "Ask about a feature, function, route or file. Answers include source references.",
  ASK: "Ask about this repository",
  ASK_ABOUT: (identity: string) => `Ask about ${identity}`,
  SEARCH_INPUT_ID: "repository-search",
  INDEXED_COMMIT: "Indexed commit",
  CANCEL_INDEXING: "Cancel indexing",
  GRAPH_LIMIT:
    "Graph storage is approaching the configured limit. Delete unused repositories or increase capacity before indexing more.",
  GRAPH_USAGE: (
    nodes: string,
    nodeLimit: string,
    relationships: string,
    relationshipLimit: string,
  ) =>
    `Graph usage: ${nodes} / ${nodeLimit} nodes · ${relationships} / ${relationshipLimit} relationships.`,
  INDEXED_SUCCESS: "Repository indexing has started.",
  REINDEXED_SUCCESS: "Repository reindexing has started.",
  DELETED_SUCCESS: "Repository data has been deleted.",
  CANCELLED_SUCCESS: "Indexing cancellation requested.",
} as const;

export const repositoryExampleStrings = {
  MERN: "MongoDB · Express · React · Node.js",
  PYTHON: "Python · Flask · FastAPI",
  TITLE: "Try a public repository",
  USE: (name: string) => `Use ${name} example`,
  BUILT_FOR: "Built for MERN and Python code exploration",
  DESCRIPTION:
    "Find React components, Express routes, backend models, Python functions and classes, and follow imports across files. Dependency manifests and common client/server folders add context.",
  LIMITATIONS:
    "Static analysis only. Dynamic calls, injected dependencies and framework behavior may remain unresolved. Start with a small repository; large projects can reach indexing or API limits.",
  INSTRUCTION:
    "Use example fills the URL below. Click Index repository when you are ready.",
} as const;
