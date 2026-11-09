export const answerStrings = {
  LIMITED_EVIDENCE: "Limited evidence",
  UNAVAILABLE: "Answer unavailable.",
  SCOPE_UNAVAILABLE: "Scope information unavailable.",
  QUESTION_FALLBACK: "Repository question",
  SCOPE: "Scope and limitations",
  COMMIT_LABEL: (commit: string, runId: string) => `Commit ${commit} · Run ${runId}`,
  CITATION_LABEL: (path: string, start: string | number, end: string | number) =>
    `${path}:${start}–${end}`,
  EMPTY_READY: "Ask how a feature works or where a function is called.",
  EMPTY_UNREADY: "Index a repository to start asking questions.",
} as const;
