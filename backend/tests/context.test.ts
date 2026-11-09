import { it, expect } from "vitest";
import { fuse, packEvidence } from "../src/services/retrieval/context.js";
import type { Evidence } from "../src/models/index.js";

const chunk = (id: string, text = "code"): Evidence => ({
  id,
  snapshotId: "s",
  symbolId: "symbol",
  path: `${id}.ts`,
  name: id,
  startLine: 1,
  endLine: 1,
  text,
  contentHash: id,
  score: 0,
});
it("combines ranks without comparing incompatible raw scores", () => {
  const a = chunk("a"),
    b = chunk("b");

  const result = fuse([[{ ...a, score: 1000 }, b], [{ ...b, score: 0.9 }]]);
  expect(result[0]?.id).toBe("b");
});
it("deduplicates identical file content and skips evidence that exceeds budget", () => {
  const a = chunk("a");
  expect(packEvidence([a, a], 1000)).toHaveLength(1);
  expect(packEvidence([chunk("big", "long ".repeat(5000))], 500)).toEqual([]);
});

it("covers separate files before extra fragments from one document", () => {
  const docs = Array.from({ length: 12 }, (_, i) => ({
    ...chunk(`doc-${i}`, `paragraph ${i}`),
    path: "README.md",
    score: 100 - i,
  }));

  const implementation = {
    ...chunk("implementation", "export function validate() {}"),
    path: "src/validate.ts",
    score: 1,
  };
  expect(
    packEvidence([...docs, implementation], 14000, 2).map((c) => c.path),
  ).toEqual(["README.md", "src/validate.ts"]);
});
it("supports conservative UTF-8 packing independently of embedding token estimates", () => {
  const item = chunk("unicode", "😀".repeat(100));
  expect(
    packEvidence([item], 300, 12, (t) => Buffer.byteLength(t, "utf8")),
  ).toEqual([]);
});
