import * as yup from "yup";
import type { Evidence } from "../models/index.js";
import { providerStrings } from "../constants/providers.js";
import { AppError } from "../utils/app-error.js";

export const answerFormat = {
  type: "json_schema",
  name: "repository_answer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
      evidenceIds: { type: "array", items: { type: "string" } },
      limitations: { type: "array", items: { type: "string" } },
      abstained: { type: "boolean" },
    },
    required: ["answer", "evidenceIds", "limitations", "abstained"],
  },
};

export const generatedSchema = yup
  .object({
    answer: yup.string().max(24000).required(),
    evidenceIds: yup.array(yup.string().required()).max(12).required(),
    limitations: yup
      .array(yup.string().max(2000).required())
      .max(12)
      .required(),
    abstained: yup.boolean().required(),
  })
  .noUnknown();

export type Generated = yup.InferType<typeof generatedSchema>;

export interface AI {
  embed(
    texts: string[],
    signal: AbortSignal,
    purpose?: "document" | "query",
  ): Promise<number[][]>;
  generate(
    question: string,
    evidence: Evidence[],
    history: { question: string; answer: string }[],
    signal: AbortSignal,
  ): Promise<{ result: Generated; inputTokens: number; outputTokens: number }>;
}

export const instructions = providerStrings.PROMPT;

export function providerFailure(error: unknown): never {
  const status =
    error && typeof error === "object" && "status" in error
      ? error.status
      : undefined;
  if (status === 401 || status === 403)
    throw new AppError(
      "PROVIDER_AUTH",
      providerStrings.AUTH,
      503,
    );
  if (status === 429)
    throw new AppError(
      "PROVIDER_LIMIT",
      providerStrings.LIMIT,
      503,
      true,
    );
  if (status === 402)
    throw new AppError(
      "PROVIDER_BILLING",
      providerStrings.BILLING,
      503,
    );
  if (status === 400 || status === 404)
    throw new AppError(
      "PROVIDER_CONFIGURATION",
      providerStrings.CONFIGURATION,
      503,
    );
  if (error instanceof Error && /abort|timeout/i.test(error.name))
    throw new AppError(
      "PROVIDER_TIMEOUT",
      providerStrings.TIMEOUT,
      504,
      true,
    );
  throw new AppError(
    "PROVIDER_UNAVAILABLE",
    providerStrings.UNAVAILABLE,
    503,
    true,
  );
}

export function prompt(
  question: string,
  evidence: Evidence[],
  history: { question: string; answer: string }[],
) {
  return JSON.stringify({
    question,
    history,
    evidence: evidence.map((e) => ({
      id: e.id,
      name: e.name,
      context: e.context,
      path: e.path,
      startLine: e.startLine,
      endLine: e.endLine,
      text: e.text,
    })),
  });
}

// Conservative Groq text bound, shared by context validation and budget reservation.
export function answerInputTokens(
  question: string,
  evidence: Evidence[],
  history: { question: string; answer: string }[],
) {
  return (
    Buffer.byteLength(
      `${instructions}\n${prompt(question, evidence, history)}\n${JSON.stringify(answerFormat)}`,
      "utf8",
    ) + 2000
  );
}
