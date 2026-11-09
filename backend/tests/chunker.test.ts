import { describe, it, expect } from "vitest";
import { splitSource } from "../src/services/analysis/chunker.js";
import { CHUNK_POLICY } from "../src/constants/chunking.js";
import { analyze } from "../src/services/analysis/parser.js";
import { countTokens } from "../src/services/retrieval/context.js";

describe("symbol-aware embedding chunks", () => {
  it("keeps a small function intact without artificial overlap", () => {
    const source =
      "function validate(token: string) { return token.length > 0; }";

    const chunks = splitSource(source, { firstLine: 7, overlap: true });
    expect(chunks).toEqual([
      { text: source, start: 0, end: source.length, startLine: 7, endLine: 7 },
    ]);
  });
  it("preserves every source character and bounded overlap for large symbols", () => {
    const source = Array.from(
      { length: 400 },
      (_, i) => `  const value${i} = processValue(${i});\n`,
    ).join("");

    const chunks = splitSource(source, {
      contextTokens: 100,
      overlap: true,
      preferredLines: new Set(Array.from({ length: 400 }, (_, i) => i + 1)),
    });
    expect(chunks.length).toBeGreaterThan(1);
    const covered = new Uint8Array(source.length);
    for (const [i, c] of chunks.entries()) {
      expect(c.text).toBe(source.slice(c.start, c.end));
      expect(countTokens(c.text) + 100).toBeLessThanOrEqual(CHUNK_POLICY.max);
      covered.fill(1, c.start, c.end);
      if (i) {
        const previous = chunks[i - 1]!;

        const overlap = countTokens(source.slice(c.start, previous.end));
        expect(overlap).toBeGreaterThanOrEqual(50);
        expect(overlap).toBeLessThanOrEqual(100);
        expect(c.start).toBeGreaterThan(previous.start);
      }
    }
    expect(covered.every(Boolean)).toBe(true);
  });
  it("splits long single lines without omitting content or producing duplicate spans", () => {
    const text =
      "const values = [" +
      Array.from({ length: 2500 }, (_, i) => `${i},`).join("") +
      "];";

    const chunks = splitSource(text, { overlap: true });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.start).toBe(0);
    expect(chunks.at(-1)?.end).toBe(text.length);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      expect(chunk.startLine).toBe(1);
      expect(chunk.endLine).toBe(1);
      expect(countTokens(chunk.text)).toBeLessThanOrEqual(1500);
      if (i) expect(chunk.start).toBeLessThan(chunks[i - 1]!.end);
    }
  });
  it("puts file, scope, signature and imports in bounded embedding context", () => {
    const analysis = analyze(
      [
        {
          path: "service.ts",
          text: 'import {validate} from "./validation.js";\nexport class UserService {\n  login(token: string) { return validate(token); }\n}',
        },
      ],
      "s",
    );

    const method = analysis.chunks.find((c) => c.name === "UserService.login");
    expect(method?.embeddingText).toContain("File: service.ts");
    expect(method?.embeddingText).toContain("Symbol: UserService.login");
    expect(method?.embeddingText).toContain("Signature: login(token: string)");
    expect(method?.embeddingText).toContain("import {validate}");
    for (const chunk of analysis.chunks)
      expect(
        countTokens(chunk.embeddingText ?? chunk.text),
      ).toBeLessThanOrEqual(1500);
    expect(method?.text).toBe(
      "login(token: string) { return validate(token); }",
    );
    expect(method?.startLine).toBe(3);
  });
});
