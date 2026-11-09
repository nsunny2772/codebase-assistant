import { getEncoding } from "js-tiktoken";
import type { Evidence } from "../../models/index.js";
import { hash } from "../../utils/hash.js";

const encoding = getEncoding("cl100k_base");

// This is a conservative estimator for unconfigured model tokenizers. The caller
// reserves additional context headroom; it never advertises exact provider counts.
export const countTokens = (text: string) => encoding.encode(text).length;

export function packEvidence(
  candidates: Evidence[],
  tokenBudget = 14000,
  maxChunks = 12,
  measure: (text: string) => number = countTokens,
): Evidence[] {
  const selected: Evidence[] = [],
    seen = new Set<string>();
  let used = 0;
  // Cover distinct files before filling the remaining budget with more fragments
  // from the same file. Long documentation must not crowd out implementation.
  const paths = new Set<string>(),
    first: Evidence[] = [],
    remaining: Evidence[] = [];
  for (const item of [...candidates].sort((a, b) => b.score - a.score)) {
    (paths.has(item.path) ? remaining : first).push(item);
    paths.add(item.path);
  }
  for (const item of [...first, ...remaining]) {
    const key = `${item.path}:${hash(item.text)}`;

    const cost =
      measure(
        JSON.stringify({
          id: item.id,
          name: item.name,
          context: item.context,
          path: item.path,
          startLine: item.startLine,
          endLine: item.endLine,
          text: item.text,
        }),
      ) + 20;
    if (seen.has(key) || used + cost > tokenBudget) continue;
    selected.push(item);
    seen.add(key);
    used += cost;
    if (selected.length >= maxChunks) break;
  }
  return selected;
}

export function fuse(lists: Evidence[][]): Evidence[] {
  const merged = new Map<string, Evidence>();
  for (const list of lists)
    list.forEach((item, rank) => {
      const old = merged.get(item.id);
      merged.set(item.id, {
        ...item,
        score: (old?.score ?? 0) + 1 / (60 + rank + 1),
      });
    });
  return [...merged.values()].sort((a, b) => b.score - a.score);
}
