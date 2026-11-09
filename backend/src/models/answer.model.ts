import type { Chunk } from "./analysis.model.js";

export interface Evidence extends Chunk {
  score: number;
}

export interface Citation {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  url: string;
}

export interface Answer {
  runId: string;
  snapshotId: string;
  commit: string;
  answer: string;
  citations: Citation[];
  limitations: string[];
  abstained: boolean;
  usage: { inputTokens: number; outputTokens: number };
  retrievalRounds: number;
}
