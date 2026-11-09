import { commonStrings } from "@src/constants/common";

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : commonStrings.COMMON.REQUEST_FAILED;
