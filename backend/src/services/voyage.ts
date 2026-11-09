import * as yup from "yup";
import type { Config } from "../config/index.js";
import { providerStrings } from "../constants/providers.js";
import { AppError } from "../utils/app-error.js";
import { countTokens } from "./retrieval/context.js";
import { providerFailure } from "./ai.js";

const responseSchema = yup
  .object({
    data: yup
      .array(
        yup
          .object({
            index: yup.number().integer().min(0).required(),
            embedding: yup.array(yup.number().required()).required(),
          })
          .noUnknown(),
      )
      .required(),
  })
  .noUnknown();

export class VoyageEmbeddings {
  constructor(
    private config: Config,
    private request: typeof fetch = fetch,
  ) {}

  async embed(
    texts: string[],
    signal: AbortSignal,
    purpose: "document" | "query" = "document",
  ): Promise<number[][]> {
    if (!texts.length) return [];
    if (!this.config.VOYAGE_API_KEY.trim())
      throw new AppError(
        "EMBEDDING_KEY_REQUIRED",
        providerStrings.EMBEDDING_KEY_REQUIRED,
        503,
      );
    if (
      texts.length > 16 ||
      texts.some(
        (text) =>
          !text.trim() ||
          countTokens(text) > (purpose === "document" ? 1500 : 2000),
      )
    )
      throw new AppError(
        "EMBEDDING_INPUT_LIMIT",
        providerStrings.EMBEDDING_INPUT_LIMIT,
        413,
      );
    const response = await this.request(
      "https://api.voyageai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.config.VOYAGE_EMBEDDING_MODEL,
          input: texts,
          input_type: purpose,
          output_dimension: this.config.VOYAGE_EMBEDDING_DIMENSIONS,
          output_dtype: "float",
          truncation: false,
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
        redirect: "error",
      },
    ).catch(providerFailure);
    if (!response.ok) providerFailure({ status: response.status });
    if (!response.body)
      throw new AppError(
        "EMBEDDING_RESPONSE",
        providerStrings.VOYAGE_NO_RESPONSE,
        503,
        true,
      );
    const parts: Uint8Array[] = [];
    let bytes = 0;
    for await (const part of response.body) {
      bytes += part.length;
      if (bytes > 4 * 1024 * 1024)
        throw new AppError(
          "EMBEDDING_RESPONSE",
          providerStrings.VOYAGE_RESPONSE_LIMIT,
          503,
        );
      parts.push(part);
    }
    let parsed: yup.InferType<typeof responseSchema>;
    try {
      parsed = responseSchema.validateSync(
        JSON.parse(Buffer.concat(parts).toString("utf8")),
        { strict: true },
      );
    } catch {
      throw new AppError(
        "EMBEDDING_RESPONSE",
        providerStrings.VOYAGE_INVALID_RESPONSE,
        503,
        true,
      );
    }
    const rows = parsed.data.sort((a, b) => a.index - b.index);
    if (
      rows.length !== texts.length ||
      rows.some(
        (row, index) =>
          row.index !== index ||
          row.embedding.length !== this.config.VOYAGE_EMBEDDING_DIMENSIONS ||
          !row.embedding.some((v) => v !== 0),
      )
    )
      throw new AppError(
        "EMBEDDING_RESPONSE",
        providerStrings.VOYAGE_INVALID_EMBEDDINGS,
        503,
      );
    return rows.map((row) => row.embedding);
  }
}
