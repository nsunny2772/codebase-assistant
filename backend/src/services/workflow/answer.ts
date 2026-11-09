import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";
import type { Store } from "../../repositories/store.js";
import { answerInputTokens, type AI } from "../ai.js";
import type { Answer, Evidence, Repo } from "../../models/index.js";
import { AppError } from "../../utils/app-error.js";
import { countTokens, packEvidence, fuse } from "../retrieval/context.js";
import { type Config, answerModel } from "../../config/index.js";
import { answerStrings } from "../../constants/answer.js";

export function validateCitations(ids: string[], evidence: Evidence[]) {
  const valid = new Set(evidence.map((e) => e.id));
  if (ids.some((id) => !valid.has(id)))
    throw new AppError(
      "INVALID_CITATION",
      answerStrings.INVALID_CITATION,
      503,
      true,
    );
  return [...new Set(ids)].map((id) => evidence.find((e) => e.id === id)!);
}

const canFallbackToLexicalSearch = (error: unknown) =>
  error instanceof AppError &&
  (error.code === "DAILY_BUDGET" ||
    error.code.startsWith("PROVIDER_") ||
    error.code.startsWith("EMBEDDING_"));

export async function answerQuestion(
  store: Store,
  ai: AI,
  config: Config,
  repo: Repo,
  question: string,
  conversation: string,
  snapshotId: string,
  signal: AbortSignal,
): Promise<Answer> {
  if (!(await store.snapshotReady(repo, snapshotId)))
    throw new AppError(
      "SNAPSHOT_NOT_READY",
      answerStrings.SNAPSHOT_NOT_READY,
      409,
    );
  if (countTokens(question) > 2000)
    throw new AppError(
      "QUESTION_LIMIT",
      answerStrings.QUESTION_LIMIT,
      413,
    );
  if (!answerModel(config))
    throw new AppError(
      "ANSWER_MODEL_REQUIRED",
      answerStrings.MODEL_REQUIRED,
      503,
    );
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(60000)]);

  const snapshotReadLease = await store.acquireSnapshotRead(
    repo.id,
    snapshotId,
  );
  try {
    const state = Annotation.Root({
      evidence: Annotation<Evidence[]>(),
      rounds: Annotation<number>(),
      lexicalOnly: Annotation<boolean>(),
      answer: Annotation<Answer | undefined>(),
    });

    const budget = Math.min(
      config.MAX_EVIDENCE_BYTES,
      Math.floor(
        (config.MODEL_CONTEXT_TOKENS - config.MAX_OUTPUT_TOKENS - 11000) / 1.25,
      ),
    );

    const graph = new StateGraph(state)
      .addNode("retrieve", async () => {
        let vector: number[] | undefined;
        let lexicalOnly = false;
        try {
          await store.reserve(
            "embedding",
            Math.ceil(countTokens(question) * 1.25),
          );
          vector = (await ai.embed([question], deadline, "query"))[0];
          if (!vector?.length)
            throw new AppError(
              "EMBEDDING_RESPONSE",
              answerStrings.NO_QUERY_VECTOR,
              503,
              true,
            );
        } catch (error) {
          if (deadline.aborted || !canFallbackToLexicalSearch(error))
            throw error;
          lexicalOnly = true;
        }
        const found = await store.search(snapshotId, question, vector);
        return {
          evidence: packEvidence(found, budget, 12, (text) =>
            Buffer.byteLength(text, "utf8"),
          ),
          rounds: 1,
          lexicalOnly,
        };
      })
      .addNode("expand", async (s) => {
        const additional = await store.neighbors(
          snapshotId,
          s.evidence.map((e) => e.id),
        );
        return {
          evidence: packEvidence(
            fuse([s.evidence, additional]),
            budget,
            12,
            (text) => Buffer.byteLength(text, "utf8"),
          ),
          rounds: s.rounds + 1,
        };
      })
      .addNode("generate", async (s) => {
        const base: Answer = {
          runId: randomUUID(),
          snapshotId,
          commit: "",
          answer: answerStrings.NO_EVIDENCE,
          citations: [],
          limitations: [
            answerStrings.STATIC_LIMITATION,
            answerStrings.CANDIDATE_LIMITATION,
            ...(s.lexicalOnly
              ? [
                  answerStrings.LEXICAL_LIMITATION,
                ]
              : []),
          ],
          abstained: true,
          usage: { inputTokens: 0, outputTokens: 0 },
          retrievalRounds: s.rounds,
        };

        // Retained snapshot commit must be derived from evidence scope, not current branch head.
        const commit = await snapshotCommit(store, repo, snapshotId);
        base.commit = commit;
        if (!s.evidence.length) return { answer: base };
        const prior = await store.history(repo.id, snapshotId, conversation);

        const history: typeof prior = [];
        let historyTokens = 0;
        for (const turn of prior.reverse()) {
          const cost = Buffer.byteLength(JSON.stringify(turn), "utf8");
          if (historyTokens + cost > 2000) break;
          history.unshift(turn);
          historyTokens += cost;
        }
        await store.reserve(
          "answer",
          answerInputTokens(question, s.evidence, history) +
            config.MAX_OUTPUT_TOKENS,
        );
        const generated = await ai.generate(
          question,
          s.evidence,
          history,
          deadline,
        );

        const inlineIds = [
          ...generated.result.answer.matchAll(/\[([a-f0-9]{64})\]/g),
        ].map((m) => m[1]!);

        const refs = validateCitations(
          [...generated.result.evidenceIds, ...inlineIds],
          s.evidence,
        );
        if (!generated.result.abstained && !refs.length)
          throw new AppError(
            "MISSING_CITATIONS",
            answerStrings.MISSING_CITATIONS,
            503,
            true,
          );
        return {
          answer: {
            ...base,
            answer: generated.result.answer,
            abstained: generated.result.abstained,
            limitations: [...base.limitations, ...generated.result.limitations],
            citations: refs.map((e) => ({
              id: e.id,
              path: e.path,
              startLine: e.startLine,
              endLine: e.endLine,
              url: `${repo.url}/blob/${commit}/${e.path.split("/").map(encodeURIComponent).join("/")}#L${e.startLine}-L${e.endLine}`,
            })),
            usage: {
              inputTokens: generated.inputTokens,
              outputTokens: generated.outputTokens,
            },
          },
        };
      })
      .addEdge(START, "retrieve")
      .addConditionalEdges("retrieve", (s) =>
        s.evidence.length ? "expand" : "generate",
      )
      .addConditionalEdges("expand", (s) =>
        s.rounds < 3 && s.evidence.length < 4 ? "expand" : "generate",
      )
      .addEdge("generate", END)
      .compile();

    const result = await graph.invoke(
      { evidence: [], rounds: 0, lexicalOnly: false, answer: undefined },
      { recursionLimit: 8, signal: deadline },
    );
    if (!result.answer)
      throw new AppError(
        "ANSWER_FAILED",
        answerStrings.WORKFLOW_FAILED,
        503,
      );
    deadline.throwIfAborted();
    await store.recordAnswer(repo.id, conversation, question, result.answer);
    return result.answer;
  } finally {
    await store.releaseSnapshotRead(snapshotReadLease).catch(() => undefined);
  }
}

async function snapshotCommit(store: Store, repo: Repo, snapshot: string) {
  // The public method below resolves immutable snapshot metadata even after refresh.
  return store.getSnapshotCommit(repo.id, snapshot);
}
