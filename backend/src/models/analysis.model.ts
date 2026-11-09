export interface SourceFile {
  path: string;
  text: string;
}

export interface SymbolInfo {
  id: string;
  snapshotId: string;
  path: string;
  name: string;
  scope: string;
  kind: string;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}

export interface Chunk {
  id: string;
  snapshotId: string;
  symbolId: string;
  path: string;
  name: string;
  startLine: number;
  endLine: number;
  text: string;
  contentHash: string;
  embeddingText?: string;
  context?: string;
  embedding?: number[];
}

export interface FileChunkSummary {
  path: string;
  chunks: number;
  embeddedChunks: number;
}

export interface Edge {
  from: string;
  to: string;
  kind: "CALLS" | "IMPORTS";
  path: string;
  line: number;
}

export interface Analysis {
  symbols: SymbolInfo[];
  chunks: Chunk[];
  edges: Edge[];
  warnings: string[];
  unresolvedCalls: number;
  files: number;
}
