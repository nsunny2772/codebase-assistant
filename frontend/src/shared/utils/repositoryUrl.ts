import { GIT_SUFFIX_REGEX, TRAILING_SLASHES_REGEX } from "@src/shared/utils/regex";

export const normalizeRepositoryUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return `${url.hostname.toLowerCase()}${url.pathname
      .replace(TRAILING_SLASHES_REGEX, "")
      .replace(GIT_SUFFIX_REGEX, "")
      .toLowerCase()}`;
  } catch {
    return "";
  }
};
