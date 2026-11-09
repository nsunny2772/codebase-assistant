export const answerStrings = {
  INVALID_CITATION: "Generated answer referenced unavailable evidence.",
  SNAPSHOT_NOT_READY:
    "Index the repository for the selected embedding model before asking questions.",
  QUESTION_LIMIT: "Question exceeds the token budget.",
  MODEL_REQUIRED:
    "Configure the selected provider answer model before asking questions.",
  NO_QUERY_VECTOR: "The embedding provider returned no query vector.",
  MISSING_CITATIONS: "The answer contained no supporting citations.",
  WORKFLOW_FAILED: "Answer workflow did not complete.",
  INVALID_QUESTION: "Enter a question.",
  CONTEXT_LIMIT:
    "Question and evidence exceed the configured context budget. Narrow the question.",
  INVALID_OUTPUT: "Model output failed validation.",
  INCOMPLETE:
    "The model did not complete an answer. Try a narrower question.",
  NO_EVIDENCE:
    "No sufficient source evidence was found. Try a file path, function name, or a more specific question.",
  STATIC_LIMITATION:
    "Static analysis may not resolve dynamic calls, injected services, path aliases, or missing external dependencies.",
  CANDIDATE_LIMITATION:
    "Search candidates are bounded and may omit relevant code in large indexes.",
  LEXICAL_LIMITATION:
    "Question embeddings were unavailable; retrieval used exact and full-text matches only, so semantically related code may be missed.",
} as const;
