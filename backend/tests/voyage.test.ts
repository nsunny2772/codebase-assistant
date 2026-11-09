import { describe, it, expect, vi } from "vitest";
import { VoyageEmbeddings } from "../src/services/voyage.js";
import { createAI } from "../src/services/provider.js";
import {
  parseConfig,
  missingEmbeddingCredentials,
  missingCredentials,
  embeddingIdentity,
} from "../src/config/index.js";

const config = parseConfig({ VOYAGE_API_KEY: "test-voyage-key" });

const vector = (n = 1) =>
  Array.from({ length: 1024 }, (_, i) => (i === 0 ? n : 0));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
describe("Voyage code embeddings", () => {
  it("sends document and query task types, dimensions, and disables truncation", async () => {
    const request = vi.fn(
      async (_url: Parameters<typeof fetch>[0], _options?: RequestInit) => {
        void _url;
        void _options;
        return json({ data: [{ index: 0, embedding: vector() }] });
      },
    );

    const ai = new VoyageEmbeddings(config, request),
      signal = new AbortController().signal;
    expect((await ai.embed(["code"], signal, "document"))[0]).toHaveLength(
      1024,
    );
    await ai.embed(["question"], signal, "query");
    expect(request.mock.calls[0]?.[0]).toBe(
      "https://api.voyageai.com/v1/embeddings",
    );
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "voyage-code-4",
      input_type: "document",
      output_dimension: 1024,
      truncation: false,
    });
    expect(
      JSON.parse(String(request.mock.calls[1]?.[1]?.body)).input_type,
    ).toBe("query");
  });
  it("restores batch ordering and rejects missing or duplicate indexes", async () => {
    const ai = new VoyageEmbeddings(config, async () =>
      json({
        data: [
          { index: 1, embedding: vector(2) },
          { index: 0, embedding: vector() },
        ],
      }),
    );
    expect(
      (await ai.embed(["a", "b"], new AbortController().signal)).map(
        (v) => v[0],
      ),
    ).toEqual([1, 2]);
    const bad = new VoyageEmbeddings(config, async () =>
      json({
        data: [
          { index: 0, embedding: vector() },
          { index: 0, embedding: vector() },
        ],
      }),
    );
    await expect(
      bad.embed(["a", "b"], new AbortController().signal),
    ).rejects.toThrow("ordering");
  });
  it("rejects incorrect dimensions and malformed responses", async () => {
    const ai = new VoyageEmbeddings(config, async () =>
      json({ data: [{ index: 0, embedding: [1, 2, 3] }] }),
    );
    await expect(ai.embed(["a"], new AbortController().signal)).rejects.toThrow(
      "dimensions",
    );
    const invalid = new VoyageEmbeddings(config, async () =>
      json({ data: "bad" }),
    );
    await expect(
      invalid.embed(["a"], new AbortController().signal),
    ).rejects.toThrow("validation");
  });
  it("maps quota failures without exposing provider responses or keys", async () => {
    const ai = new VoyageEmbeddings(config, async () =>
      json({ error: "test-voyage-key" }, 429),
    );
    await expect(ai.embed(["a"], new AbortController().signal)).rejects.toThrow(
      "quota or rate limit",
    );
  });
  it("fails locally before a request when credentials or chunk budget are missing", async () => {
    const request = vi.fn();

    const empty = new VoyageEmbeddings(parseConfig({}), request);
    await expect(
      empty.embed(["a"], new AbortController().signal),
    ).rejects.toThrow("VOYAGE_API_KEY");
    expect(request).not.toHaveBeenCalled();
    const ai = new VoyageEmbeddings(config, request);
    await expect(
      ai.embed(["token ".repeat(1700)], new AbortController().signal),
    ).rejects.toThrow("budget");
    expect(request).not.toHaveBeenCalled();
  });
  it("keeps embedding credentials independent from answer credentials", () => {
    const c = parseConfig({
      VOYAGE_API_KEY: "test",
      NEO4J_URI: "neo4j://localhost",
      NEO4J_PASSWORD: "test",
    });
    expect(missingEmbeddingCredentials(c)).toEqual([]);
    expect(missingCredentials(c)).toEqual(["GROQ_API_KEY"]);
    expect(() => createAI(c)).not.toThrow();
    expect(embeddingIdentity(c)).toBe(
      "voyage:voyage-code-4:1024:context-chunks-v2",
    );
    expect(() => parseConfig({ VOYAGE_EMBEDDING_DIMENSIONS: "1536" })).toThrow(
      "VOYAGE_EMBEDDING_DIMENSIONS",
    );
  });
});
