import { indexingStrings } from "@src/constants/indexing";

export const renderWarning = (warning: string, index: number) => (
  <li key={index}>{warning || indexingStrings.WARNING_UNAVAILABLE}</li>
);
