import tar from "tar-stream";
import { createGunzip } from "node:zlib";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { SourceFile, Repo } from "../../models/index.js";
import { AppError } from "../../utils/app-error.js";
import { supportedPath, safePath } from "../analysis/parser.js";
import type { Config } from "../../config/index.js";
import { repositoryStrings } from "../../constants/repository.js";

type Fetch = typeof fetch;
async function limitedJson(
  response: Response,
  limit = 1024 * 1024,
): Promise<unknown> {
  if (!response.body)
    throw new AppError(
      "GITHUB_RESPONSE",
      repositoryStrings.GITHUB_NO_DATA,
      503,
      true,
    );
  const parts: Uint8Array[] = [];
  let bytes = 0;
  for await (const part of response.body) {
    bytes += part.length;
    if (bytes > limit)
      throw new AppError(
        "GITHUB_RESPONSE",
        repositoryStrings.GITHUB_METADATA_LIMIT,
        413,
      );
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}

export class GitHubSource {
  constructor(
    private config: Config,
    private request: Fetch = fetch,
  ) {}

  private async get(
    url: string,
    signal: AbortSignal,
    headers?: Record<string, string>,
  ) {
    const origin = new URL(url).origin;
    for (let hop = 0; hop < 4; hop++) {
      let response: Response;
      try {
        response = await this.request(url, {
          headers,
          signal,
          redirect: "manual",
        });
      } catch {
        throw new AppError(
          "GITHUB_UNAVAILABLE",
          repositoryStrings.GITHUB_REQUEST_FAILED,
          503,
          true,
        );
      }
      if (![301, 302, 303, 307, 308].includes(response.status))
        return { response, url };
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location)
        throw new AppError(
          "GITHUB_REDIRECT",
          repositoryStrings.GITHUB_INVALID_REDIRECT,
          503,
        );
      const next = new URL(location, url);
      if (
        hop === 3 ||
        next.origin !== origin ||
        next.username ||
        next.password ||
        next.hash ||
        (next.hostname === "api.github.com" &&
          !/^\/(?:repos\/[\w.-]+\/[\w.-]+|repositories\/\d+)(?:\/commits\/[^/]+)?$/.test(
            next.pathname,
          )) ||
        (next.hostname === "codeload.github.com" &&
          !/^\/[\w.-]+\/[\w.-]+\/tar\.gz\/[a-f0-9]{40}$/.test(next.pathname))
      )
        throw new AppError(
          "GITHUB_REDIRECT",
          repositoryStrings.GITHUB_REDIRECT_DENIED,
          503,
        );
      url = next.href;
    }
    throw new AppError("GITHUB_REDIRECT", repositoryStrings.GITHUB_REDIRECT_LIMIT, 503);
  }

  async resolve(
    repo: Pick<Repo, "owner" | "name">,
    signal: AbortSignal,
  ): Promise<string> {
    const base = `https://api.github.com/repos/${repo.owner}/${repo.name}`;

    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "AI-Codebase-Assistant",
    };

    const resolved = await this.get(base, signal, headers);

    const metadata = resolved.response;
    if (!metadata.ok)
      throw new AppError(
        metadata.status === 404 ? "REPOSITORY_NOT_FOUND" : "GITHUB_UNAVAILABLE",
        repositoryStrings.GITHUB_READ_FAILED,
        metadata.status === 404 ? 404 : 503,
        metadata.status !== 404,
      );
    const info = (await limitedJson(metadata)) as {
      private?: boolean;
      default_branch?: string;
      size?: number;
    };
    if (info.private !== false || !info.default_branch)
      throw new AppError(
        "PUBLIC_REPOSITORY_REQUIRED",
        repositoryStrings.ONLY_PUBLIC,
      );
    if ((info.size ?? 0) * 1024 > this.config.MAX_REPOSITORY_BYTES * 10)
      throw new AppError(
        "REPOSITORY_LIMIT",
        repositoryStrings.TOO_LARGE,
        413,
      );
    const { response: commit } = await this.get(
      `${resolved.url}/commits/${encodeURIComponent(info.default_branch)}`,
      signal,
      headers,
    );
    if (!commit.ok)
      throw new AppError(
        "GITHUB_UNAVAILABLE",
        repositoryStrings.GITHUB_COMMIT_FAILED,
        503,
        true,
      );
    const data = (await limitedJson(commit)) as { sha?: string };
    if (!data.sha || !/^[a-f0-9]{40}$/.test(data.sha))
      throw new AppError("GITHUB_RESPONSE", repositoryStrings.GITHUB_INVALID_COMMIT_RESPONSE, 503);
    return data.sha;
  }

  async download(
    repo: Pick<Repo, "owner" | "name">,
    commit: string,
    signal: AbortSignal,
  ): Promise<{ files: SourceFile[]; warnings: string[] }> {
    if (!/^[a-f0-9]{40}$/.test(commit))
      throw new AppError("INVALID_COMMIT", repositoryStrings.INVALID_COMMIT);
    // No credentials sent to codeload; redirects remain on validated GitHub paths.
    const { response } = await this.get(
      `https://codeload.github.com/${repo.owner}/${repo.name}/tar.gz/${commit}`,
      signal,
    );
    if (!response.ok || !response.body)
      throw new AppError(
        "GITHUB_DOWNLOAD",
        repositoryStrings.GITHUB_DOWNLOAD_FAILED,
        503,
        true,
      );
    return extractSnapshot(
      Readable.fromWeb(response.body as never),
      this.config,
      signal,
    );
  }
}

export async function extractSnapshot(
  input: Readable,
  config: Pick<Config, "MAX_SOURCE_FILES" | "MAX_REPOSITORY_BYTES">,
  signal = new AbortController().signal,
): Promise<{ files: SourceFile[]; warnings: string[] }> {
  const extract = tar.extract();

  const files: SourceFile[] = [],
    warnings: string[] = [];
  let compressed = 0,
    expanded = 0,
    entries = 0;
  const names = new Set<string>();

  const compressedLimit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      compressed += chunk.length;
      done(
        compressed > config.MAX_REPOSITORY_BYTES
          ? new AppError(
              "REPOSITORY_LIMIT",
          repositoryStrings.EXCEEDS_ARCHIVE_BYTES,
              413,
            )
          : null,
        chunk,
      );
    },
  });

  const expandedLimit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      expanded += chunk.length;
      done(
        expanded > config.MAX_REPOSITORY_BYTES * 4
          ? new AppError(
              "REPOSITORY_LIMIT",
          repositoryStrings.EXCEEDS_EXPANDED_BYTES,
              413,
            )
          : null,
        chunk,
      );
    },
  });
  extract.on("entry", (header, stream, next) => {
    void (async () => {
      if (++entries > 50000)
        throw new AppError(
          "REPOSITORY_LIMIT",
          repositoryStrings.TOO_MANY_ARCHIVE_ENTRIES,
          413,
        );
      const raw = header.name.replace(/\/$/, "");
      if (!safePath(raw))
        throw new AppError(
          "UNSAFE_ARCHIVE",
          repositoryStrings.UNSAFE_PATH,
        );
      if (header.type !== "file" && header.type !== "directory") {
        if (header.type === "symlink" || header.type === "link") {
          warnings.push(repositoryStrings.SYMBOLIC_LINKS_SKIPPED);
          stream.resume();
          return;
        }
        throw new AppError("UNSAFE_ARCHIVE", repositoryStrings.UNSUPPORTED_ENTRY);
      }
      const file = raw.split("/").slice(1).join("/");
      if (header.type !== "file" || !file || !supportedPath(file)) {
        stream.resume();
        return;
      }
      if (header.size > 1024 * 1024) {
        warnings.push(`${file}: file larger than 1 MiB skipped`);
        stream.resume();
        return;
      }
      if (files.length >= config.MAX_SOURCE_FILES)
        throw new AppError(
          "REPOSITORY_LIMIT",
            repositoryStrings.TOO_MANY_FILES,
          413,
        );
      if (names.has(file))
        throw new AppError("UNSAFE_ARCHIVE", repositoryStrings.DUPLICATE_PATH);
      names.add(file);
      const parts: Buffer[] = [];
      let size = 0;
      for await (const part of stream) {
        const buffer = Buffer.isBuffer(part)
          ? part
          : Buffer.from(part as Uint8Array);
        size += buffer.length;
        if (size > 1024 * 1024)
          throw new AppError(
            "REPOSITORY_LIMIT",
            repositoryStrings.FILE_TOO_LARGE,
            413,
          );
        parts.push(buffer);
      }
      const text = Buffer.concat(parts).toString("utf8");
      // Conservative exclusion of likely committed secrets before sending code to providers.
      if (
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-proj-|ghp_)[A-Za-z0-9_-]{20,}/.test(
          text,
        )
      )
        warnings.push(`${file}: likely credential content excluded`);
      else if (!text.includes("\0")) files.push({ path: file, text });
    })().then(
      () => next(),
      (error) => extract.destroy(error as Error),
    );
  });
  await pipeline(
    input,
    compressedLimit,
    createGunzip(),
    expandedLimit,
    extract,
    { signal },
  );
  if (!files.length)
    throw new AppError(
      "NO_SUPPORTED_FILES",
      repositoryStrings.NO_SUPPORTED_FILES,
    );
  return { files, warnings: [...new Set(warnings)].slice(0, 100) };
}
