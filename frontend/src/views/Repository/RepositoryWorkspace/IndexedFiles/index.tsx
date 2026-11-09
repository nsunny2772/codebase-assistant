import type { RepositoryFileChunk } from "@src/shared/types/repository";
import type { IndexedFilesProps } from "@src/types/repositoryWorkspace";
import { indexingStrings } from "@src/constants/indexing";

import styles from "./indexedFiles.module.scss";

const renderFile = (file: RepositoryFileChunk) => (
  <li key={file.path} className={styles.file}>
    <code>{file.path}</code>
    <span>{indexingStrings.FILE_CHUNKS(file.embeddedChunks, file.chunks)}</span>
  </li>
);

export const IndexedFiles = ({ files }: IndexedFilesProps) => {
  if (!files.length) return null;

  const chunkCount = files.reduce((total, file) => total + file.chunks, 0);

  return (
    <details className={styles.details}>
      <summary>{indexingStrings.FILE_SUMMARY(files.length, chunkCount)}</summary>
      <ul>{files.map(renderFile)}</ul>
    </details>
  );
};
