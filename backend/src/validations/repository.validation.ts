import type { Repo } from "../models/index.js";
import { repositoryStrings } from "../constants/repository.js";
import { AppError } from "../utils/app-error.js";
import { hash } from "../utils/hash.js";

export const parseRepository = (
  input: string,
): Pick<Repo, "id" | "url" | "owner" | "name"> => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError(
      "INVALID_REPOSITORY",
      repositoryStrings.INVALID_URL,
    );
  }

  const match = /^\/([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.pathname);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !match ||
    match[2] === "." ||
    match[2] === ".."
  ) {
    throw new AppError(
      "INVALID_REPOSITORY",
      repositoryStrings.INVALID_URL_FORMAT,
    );
  }

  const owner = match[1]!.toLowerCase();

  const name = match[2]!.toLowerCase();
  return {
    id: hash(`${owner}/${name}`),
    owner,
    name,
    url: `https://github.com/${owner}/${name}`,
  };
};
