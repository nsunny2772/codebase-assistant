import { countTokens } from "../retrieval/context.js";
import { indexingStrings } from "../../constants/indexing.js";
import { CHUNK_POLICY } from "../../constants/chunking.js";
interface Unit {
  start: number;
  end: number;
  line: number;
}
export interface SourcePart {
  text: string;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}

/** Source text is never decorated here, preserving exact spans for citations. */
export function splitSource(
  text: string,
  options: {
    firstLine?: number;
    contextTokens?: number;
    overlap?: boolean;
    preferredLines?: Set<number>;
  } = {},
): SourcePart[] {
  if (!text.trim()) return [];
  const firstLine = options.firstLine ?? 1;

  const max = CHUNK_POLICY.max - (options.contextTokens ?? 0) - 2;

  const target = CHUNK_POLICY.targetMax - (options.contextTokens ?? 0) - 2;

  const min = Math.max(
    1,
    CHUNK_POLICY.targetMin - (options.contextTokens ?? 0),
  );
  if (countTokens(text) <= max)
    return [
      {
        text,
        start: 0,
        end: text.length,
        startLine: firstLine,
        endLine:
          firstLine +
          (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n").length -
          1,
      },
    ];
  const units: Unit[] = [];
  let offset = 0,
    line = firstLine;
  for (const sourceLine of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    let start = 0;
    while (start < sourceLine.length) {
      let end = sourceLine.length;
      // Long single lines are split without dropping source. Bound tokenizer work.
      if (
        end - start > 3200 ||
        countTokens(sourceLine.slice(start, end)) > target
      ) {
        let lo = start + 1,
          hi = Math.min(end, start + 3200),
          fit = lo;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (countTokens(sourceLine.slice(start, mid)) <= target) {
            fit = mid;
            lo = mid + 1;
          } else hi = mid - 1;
        }
        end = fit;
        if (
          end < sourceLine.length &&
          /[\uD800-\uDBFF]/.test(sourceLine[end - 1]!)
        )
          end--;
        if (end <= start) end = start + 1;
      }
      units.push({ start: offset + start, end: offset + end, line });
      start = end;
    }
    offset += sourceLine.length;
    line++;
  }
  const result: SourcePart[] = [];
  let start = 0;
  while (start < units.length) {
    let end = start + 1;
    while (
      end < units.length &&
      countTokens(text.slice(units[start]!.start, units[end]!.end)) <= target
    )
      end++;
    // A retained suffix plus a long next line may exceed the target while still
    // fitting the hard ceiling. Include new source instead of emitting overlap alone.
    if (
      end === start + 1 &&
      end < units.length &&
      countTokens(text.slice(units[start]!.start, units[end]!.end)) <= max
    )
      end++;
    let boundary = end;
    for (let candidate = end; candidate > start; candidate--) {
      const unit = units[candidate - 1]!;

      const completeLine =
        candidate === units.length || units[candidate]?.line !== unit.line;
      if (
        completeLine &&
        options.preferredLines?.has(unit.line) &&
        countTokens(text.slice(units[start]!.start, unit.end)) >= min
      ) {
        boundary = candidate;
        break;
      }
    }
    end = boundary;
    const a = units[start]!,
      b = units[end - 1]!;

    const body = text.slice(a.start, b.end);
    if (body.trim())
      result.push({
        text: body,
        start: a.start,
        end: b.end,
        startLine: a.line,
        endLine: b.line,
      });
    if (end === units.length) break;
    let next = end;
    if (options.overlap) {
      while (
        next > start + 1 &&
        countTokens(text.slice(units[next - 1]!.start, b.end)) <=
          CHUNK_POLICY.overlapMax
      ) {
        next--;
        if (
          countTokens(text.slice(units[next]!.start, b.end)) >=
          CHUNK_POLICY.overlap
        )
          break;
      }
      if (
        next === end ||
        countTokens(text.slice(units[next]!.start, b.end)) < 50
      ) {
        // A long source line can exceed the overlap by itself. Retain a bounded
        // suffix instead of losing overlap or exceeding the next chunk's budget.
        let lo = Math.max(a.start + 1, b.end - 1000),
          hi = b.end - 1,
          fit = b.end;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (countTokens(text.slice(mid, b.end)) <= CHUNK_POLICY.overlap) {
            fit = mid;
            hi = mid - 1;
          } else lo = mid + 1;
        }
        if (fit < b.end) {
          units.splice(end, 0, {
            start: fit,
            end: b.end,
            line: firstLine + text.slice(0, fit).split("\n").length - 1,
          });
          next = end;
        }
      }
    }
    start = Math.max(start + 1, next);
  }
  return result;
}

export function boundedContext(
  file: string,
  scope: string,
  signature: string,
  imports: string[],
): string {
  const lines = [
    indexingStrings.FILE_CONTEXT_LABEL(file),
    indexingStrings.SYMBOL_CONTEXT_LABEL(scope),
    ...(signature ? [indexingStrings.SIGNATURE_CONTEXT_LABEL(signature)] : []),
    ...imports.slice(0, 8),
  ];
  let context = lines.join("\n");
  while (countTokens(context) > 180)
    context = context.slice(0, Math.floor(context.length * 0.85));
  return context;
}
