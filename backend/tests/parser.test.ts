import { describe, it, expect } from "vitest";
import {
  analyze,
  supportedPath,
  safePath,
} from "../src/services/analysis/parser.js";
import { parseRepository } from "../src/validations/repository.validation.js";

describe("repository and code analysis", () => {
  it("canonicalizes public GitHub repository identities", () => {
    expect(parseRepository("https://github.com/Owner/Repo.git/").url).toBe(
      "https://github.com/owner/repo",
    );
  });
  it.each([
    "http://github.com/a/b",
    "https://evil.com/a/b",
    "https://github.com:8080/a/b",
    "https://user:secret@github.com/a/b",
    "https://github.com/a/b/tree/main",
    "https://github.com/a/b?token=x",
  ])("rejects unsafe repository URL %s", (url) => {
    expect(() => parseRepository(url)).toThrow();
  });
  it("rejects archive traversal and unwanted files", () => {
    expect(safePath("../outside.ts")).toBe(false);
    expect(safePath("a/../../x.ts")).toBe(false);
    expect(safePath("a\\x.ts")).toBe(false);
    expect(supportedPath("node_modules/a.ts")).toBe(false);
    expect(supportedPath("src/app.ts")).toBe(true);
  });
  it("keeps duplicate names distinct and resolves aliases across files", () => {
    const a = analyze(
      [
        { path: "a.ts", text: "export function validate() { return true; }" },
        {
          path: "b.ts",
          text: "import { validate as check } from './a.js'; export function validate(){ return check(); }",
        },
      ],
      "snapshot",
    );

    const methods = a.symbols.filter((s) => s.name === "validate");
    expect(methods).toHaveLength(2);
    expect(new Set(methods.map((s) => s.id)).size).toBe(2);
    expect(a.edges.some((e) => e.kind === "IMPORTS")).toBe(true);
    const call = a.edges.find((e) => e.kind === "CALLS");
    expect(call?.from).toBe(methods.find((s) => s.path === "b.ts")?.id);
    expect(call?.to).toBe(methods.find((s) => s.path === "a.ts")?.id);
    expect(a.unresolvedCalls).toBe(0);
  });
  it("records unresolved dynamic calls rather than inventing targets", () => {
    const result = analyze(
      [
        {
          path: "app.ts",
          text: "export function run(obj: any, key: string) { return obj[key](); }",
        },
      ],
      "s",
    );
    expect(result.unresolvedCalls).toBe(1);
    expect(result.edges.filter((e) => e.kind === "CALLS")).toHaveLength(0);
  });
  it("preserves overloads, arrow declarations, syntax warnings and snapshot identity", () => {
    const files = [
      {
        path: "app.ts",
        text: 'export function parse(s: string): string;\nexport function parse(s: any) { return s; }\nexport const go = () => parse("a");',
      },
      { path: "bad.ts", text: "export function broken(" },
    ];

    const a = analyze(files, "one"),
      b = analyze(files, "two");
    expect(a.symbols.filter((s) => s.name === "parse")).toHaveLength(2);
    expect(a.symbols.some((s) => s.name === "go")).toBe(true);
    expect(a.warnings.length).toBeGreaterThan(0);
    expect(a.symbols[0]?.id).not.toBe(b.symbols[0]?.id);
    for (const c of a.chunks) {
      expect(c.startLine).toBeGreaterThan(0);
      expect(c.endLine).toBeGreaterThanOrEqual(c.startLine);
    }
  });
});
