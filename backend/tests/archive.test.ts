import { describe, it, expect } from "vitest";
import tar from "tar-stream";
import { gzipSync } from "node:zlib";
import { Readable } from "node:stream";
import {
  extractSnapshot,
  GitHubSource,
} from "../src/services/ingestion/github.js";
import { parseConfig } from "../src/config/index.js";

async function archive(
  entries: {
    name: string;
    text?: string;
    type?: "file" | "symlink";
    linkname?: string;
  }[],
) {
  const pack = tar.pack();

  const parts: Buffer[] = [];

  const reading = (async () => {
    for await (const part of pack) parts.push(part as Buffer);
  })();
  for (const e of entries)
    pack.entry(
      { name: e.name, type: e.type ?? "file", linkname: e.linkname },
      e.text ?? "",
    );
  pack.finalize();
  await reading;
  return Readable.from(gzipSync(Buffer.concat(parts)));
}

const config = parseConfig({});
describe("bounded repository download", () => {
  it("extracts supported files without touching disk and excludes likely secrets", async () => {
    const input = await archive([
      { name: "root/src/a.ts", text: "export const a = 1;" },
      { name: "root/.env", text: "SECRET=value" },
      { name: "root/keys.ts", text: "-----BEGIN PRIVATE KEY-----" },
      { name: "root/link.ts", type: "symlink", linkname: "/etc/passwd" },
    ]);

    const result = await extractSnapshot(input, config);
    expect(result.files.map((f) => f.path)).toEqual(["src/a.ts"]);
    expect(result.warnings).toHaveLength(2);
  });
  it("rejects path traversal", async () => {
    await expect(
      extractSnapshot(
        await archive([{ name: "root/../../escape.ts", text: "x" }]),
        config,
      ),
    ).rejects.toThrow("unsafe path");
  });
  it("enforces source file limits", async () => {
    await expect(
      extractSnapshot(
        await archive([
          { name: "root/a.ts", text: "a" },
          { name: "root/b.ts", text: "b" },
        ]),
        { ...config, MAX_SOURCE_FILES: 1 },
      ),
    ).rejects.toThrow("Too many");
  });
  it("enforces compressed byte limits", async () => {
    await expect(
      extractSnapshot(
        await archive([{ name: "root/a.ts", text: "export const a = 1;" }]),
        { ...config, MAX_REPOSITORY_BYTES: 10 },
      ),
    ).rejects.toThrow("byte limit");
  });
  it("rejects private repositories because only public repositories are supported", async () => {
    const source = new GitHubSource(
      config,
      async () =>
        new Response(JSON.stringify({ private: true, default_branch: "main" })),
    );
    await expect(
      source.resolve({ owner: "a", name: "b" }, new AbortController().signal),
    ).rejects.toThrow("Only public");
  });
  it("refuses metadata redirects and never uses user-controlled download hosts", async () => {
    let target = "",
      redirect: RequestRedirect | undefined;
    const source = new GitHubSource(config, async (url, init) => {
      target = String(url);
      redirect = init?.redirect;
      return new Response("{}", { status: 404 });
    });
    await expect(
      source.resolve({ owner: "a", name: "b" }, new AbortController().signal),
    ).rejects.toThrow();
    expect(target).toBe("https://api.github.com/repos/a/b");
    expect(redirect).toBe("manual");
  });
});

it("follows a renamed repository only within validated GitHub API paths", async () => {
  const calls: string[] = [];

  const source = new GitHubSource(config, async (url) => {
    calls.push(String(url));
    if (calls.length === 1)
      return new Response(null, {
        status: 301,
        headers: { location: "https://api.github.com/repositories/123" },
      });
    if (calls.length === 2)
      return new Response(
        JSON.stringify({ private: false, default_branch: "main" }),
      );
    return new Response(JSON.stringify({ sha: "a".repeat(40) }));
  });
  expect(
    await source.resolve(
      { owner: "a", name: "old" },
      new AbortController().signal,
    ),
  ).toBe("a".repeat(40));
  expect(calls[2]).toBe("https://api.github.com/repositories/123/commits/main");
});
it("rejects cross-origin redirects", async () => {
  let calls = 0;
  const source = new GitHubSource(config, async () => {
    calls++;
    return new Response(null, {
      status: 301,
      headers: { location: "https://evil.example/steal" },
    });
  });
  await expect(
    source.resolve({ owner: "a", name: "b" }, new AbortController().signal),
  ).rejects.toThrow("not permitted");
  expect(calls).toBe(1);
});
it("bounds redirect loops and maps transport failures to safe job errors", async () => {
  let calls = 0;
  const source = new GitHubSource(config, async () => {
    calls++;
    return new Response(null, {
      status: 301,
      headers: { location: "https://api.github.com/repos/a/b" },
    });
  });
  await expect(
    source.resolve({ owner: "a", name: "b" }, new AbortController().signal),
  ).rejects.toThrow();
  expect(calls).toBe(4);
  const offline = new GitHubSource(config, async () => {
    throw new TypeError("secret transport data");
  });
  await expect(
    offline.resolve({ owner: "a", name: "b" }, new AbortController().signal),
  ).rejects.toThrow("connectivity returns");
});
