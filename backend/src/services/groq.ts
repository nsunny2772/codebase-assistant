import * as yup from "yup";
import type { Config } from "../config/index.js";
import type { Evidence } from "../models/index.js";
import { answerStrings } from "../constants/answer.js";
import { providerStrings } from "../constants/providers.js";
import { AppError } from "../utils/app-error.js";
import {
  answerFormat,
  answerInputTokens,
  generatedSchema,
  instructions,
  prompt,
  providerFailure,
} from "./ai.js";

const responseSchema = yup
  .object({
    choices: yup
      .array(
        yup
          .object({
            finish_reason: yup.string().nullable().required(),
            message: yup
              .object({
                content: yup.string().nullable().required(),
                refusal: yup.string().nullable().optional(),
              })
              .noUnknown()
              .required(),
          })
          .noUnknown(),
      )
      .length(1)
      .required(),
    usage: yup
      .object({
        prompt_tokens: yup.number().integer().min(0).required(),
        completion_tokens: yup.number().integer().min(0).required(),
      })
      .noUnknown()
      .required(),
  })
  .noUnknown();

export class GroqService {
  constructor(
    private config: Config,
    private request: typeof fetch = fetch,
  ) {}

  private async post(
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<unknown> {
    try {
      const response = await this.request(
        `https://api.groq.com/openai/v1/${path}`,
        {
          method: "POST",
          redirect: "error",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.GROQ_API_KEY}`,
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) providerFailure({ status: response.status });
      if (!response.body) throw new Error(providerStrings.MISSING_RESPONSE);
      const parts: Uint8Array[] = [];
      let bytes = 0;
      for await (const part of response.body) {
        bytes += part.length;
        if (bytes > 4 * 1024 * 1024) {
          throw new Error(providerStrings.RESPONSE_LIMIT);
        }
        parts.push(part);
      }
      return JSON.parse(Buffer.concat(parts).toString("utf8"));
    } catch (error) {
      if (error instanceof AppError) throw error;
      providerFailure(error);
    }
  }

  async generate(
    question: string,
    evidence: Evidence[],
    history: { question: string; answer: string }[],
    signal: AbortSignal,
  ) {
    if (!this.config.GROQ_API_KEY.trim())
      throw new AppError(
        "ANSWER_KEY_REQUIRED",
        providerStrings.ANSWER_KEY_REQUIRED,
        503,
      );
    const input = prompt(question, evidence, history);

    const estimate = answerInputTokens(question, evidence, history);

    const ceiling =
      this.config.MODEL_CONTEXT_TOKENS - this.config.MAX_OUTPUT_TOKENS - 6000;
    if (estimate > ceiling)
      throw new AppError(
        "CONTEXT_LIMIT",
        answerStrings.CONTEXT_LIMIT,
        413,
      );
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(60000)]);
    // Groq has no token-count preflight here. UTF-8 bytes plus framing reserves
    // conservatively bound text input; provider usage is recorded after completion.
    let response: yup.InferType<typeof responseSchema>;
    try {
      response = responseSchema.validateSync(
        await this.post(
          "chat/completions",
          {
            model: this.config.GROQ_ANSWER_MODEL,
            messages: [
              { role: "system", content: instructions },
              { role: "user", content: input },
            ],
            max_completion_tokens: this.config.MAX_OUTPUT_TOKENS,
            stream: false,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: answerFormat.name,
                strict: true,
                schema: answerFormat.schema,
              },
            },
          },
          deadline,
        ),
        { strict: true },
      );
    } catch {
      throw new AppError(
        "INVALID_ANSWER",
        answerStrings.INVALID_OUTPUT,
        503,
        true,
      );
    }
    const choice = response.choices[0]!;
    if (
      choice.finish_reason !== "stop" ||
      !choice.message.content ||
      choice.message.refusal
    )
      throw new AppError(
        "ANSWER_INCOMPLETE",
        answerStrings.INCOMPLETE,
        503,
        true,
      );
    try {
      return {
        result: generatedSchema.validateSync(
          JSON.parse(choice.message.content),
          { strict: true },
        ),
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      };
    } catch {
      throw new AppError(
        "INVALID_ANSWER",
        answerStrings.INVALID_OUTPUT,
        503,
        true,
      );
    }
  }
}
