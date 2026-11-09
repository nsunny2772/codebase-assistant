export interface Repository {
  id: string;
  url: string;
  owner: string;
  name: string;
  activeSnapshot: string;
  commit: string;
}

export interface RepositoryFileChunk {
  path: string;
  chunks: number;
  embeddedChunks: number;
}
