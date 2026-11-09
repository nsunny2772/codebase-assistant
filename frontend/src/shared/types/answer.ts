export interface Citation {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  url: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

