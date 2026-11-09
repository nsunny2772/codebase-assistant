import { config as dotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import * as yup from "yup";
import { commonStrings } from "../constants/common.js";

const schema = yup.object({
  HOST: yup.string().min(1).default("127.0.0.1"),
  PORT: yup.number().integer().min(1).max(65535).default(3001),
  LOG_LEVEL: yup
    .mixed<"fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent">()
    .oneOf(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  AI_PROVIDER: yup.string().oneOf(["groq"]).default("groq"),
  EMBEDDING_PROVIDER: yup.string().oneOf(["voyage"]).default("voyage"),
  GROQ_API_KEY: yup.string().default(""),
  GROQ_ANSWER_MODEL: yup
    .string()
    .matches(/^[a-zA-Z0-9._/-]+$/)
    .default("qwen/qwen3.8-27b"),
  VOYAGE_API_KEY: yup.string().default(""),
  VOYAGE_EMBEDDING_MODEL: yup
    .string()
    .oneOf(["voyage-code-4"])
    .default("voyage-code-4"),
  VOYAGE_EMBEDDING_DIMENSIONS: yup.number().oneOf([1024]).default(1024),
  NEO4J_URI: yup.string().default(""),
  NEO4J_USERNAME: yup.string().default("neo4j"),
  NEO4J_PASSWORD: yup.string().default(""),
  NEO4J_DATABASE: yup.string().min(1).default("neo4j"),
  PUBLIC_ORIGIN: yup.string().url().default("http://127.0.0.1:5173"),
  MODEL_CONTEXT_TOKENS: yup.number().integer().min(32000).default(32000),
  MAX_EVIDENCE_BYTES: yup
    .number()
    .integer()
    .min(2000)
    .max(14000)
    .default(14000),
  MAX_OUTPUT_TOKENS: yup.number().integer().min(512).max(8000).default(4000),
  EMBEDDING_BATCH_SIZE: yup.number().integer().min(1).max(16).default(16),
  EMBEDDING_BATCH_DELAY_MS: yup.number().integer().min(0).max(60000).default(0),
  MAX_EMBEDDING_TOKENS_PER_JOB: yup
    .number()
    .integer()
    .min(1000)
    .max(2000000)
    .default(200000),
  DAILY_EMBEDDING_TOKEN_LIMIT: yup
    .number()
    .integer()
    .positive()
    .default(1000000),
  DAILY_ANSWER_TOKEN_LIMIT: yup.number().integer().positive().default(200000),
  MAX_SOURCE_FILES: yup.number().integer().min(1).max(5000).default(1000),
  MAX_REPOSITORY_BYTES: yup
    .number()
    .integer()
    .positive()
    .max(200 * 1024 * 1024)
    .default(50 * 1024 * 1024),
  MAX_ACTIVE_JOBS: yup.number().integer().min(1).max(20).default(3),
  GRAPH_NODE_LIMIT: yup.number().integer().positive().default(180000),
  GRAPH_RELATIONSHIP_LIMIT: yup.number().integer().positive().default(360000),
  WORKER_HEARTBEAT_INTERVAL_MS: yup
    .number()
    .integer()
    .min(1000)
    .max(60000)
    .default(10000),
  WORKER_HEARTBEAT_STALE_MS: yup
    .number()
    .integer()
    .min(5000)
    .max(300000)
    .default(45000),
  INACTIVE_SNAPSHOT_RETENTION_DAYS: yup
    .number()
    .integer()
    .min(1)
    .max(3650)
    .default(30),
  SNAPSHOT_CLEANUP_INTERVAL_MS: yup
    .number()
    .integer()
    .min(10000)
    .max(86400000)
    .default(3600000),
  INDEX_RETRY_BASE_DELAY_MS: yup
    .number()
    .integer()
    .min(100)
    .max(60000)
    .default(2000),
  INDEX_RETRY_MAX_DELAY_MS: yup
    .number()
    .integer()
    .min(100)
    .max(600000)
    .default(30000),
  INDEX_MAX_ATTEMPTS: yup.number().integer().min(1).max(8).default(3),
});

export type Config = yup.InferType<typeof schema>;

export function parseConfig(env: NodeJS.ProcessEnv): Config {
  try {
    const parsed = schema.validateSync(env, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (
      parsed.NEO4J_URI &&
      !/^(neo4j|bolt)(\+s|\+ssc)?:\/\//.test(parsed.NEO4J_URI)
    ) {
      throw new Error(`${commonStrings.INVALID_CONFIG_FIELDS} NEO4J_URI`);
    }
    return parsed;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith(commonStrings.INVALID_CONFIG_FIELDS)
    )
      throw error;
    if (error instanceof yup.ValidationError) {
      // Avoid retaining Yup's validation error because it includes raw env values.
      const fields = [
        ...new Set(error.inner.map((item) => item.path).filter(Boolean)),
      ];
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`${commonStrings.INVALID_CONFIG_FIELDS} ${fields.join(", ")}`);
    }
    throw error;
  }
}

export function loadConfig(): Config {
  dotenv({
    path: fileURLToPath(new URL("../../.env", import.meta.url)),
    quiet: true,
  });
  return parseConfig(process.env);
}

export function missingEmbeddingCredentials(config: Config): string[] {
  return (
    ["VOYAGE_API_KEY", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"] as const
  ).filter((name) => !config[name].trim());
}

export function missingCredentials(config: Config): string[] {
  return [
    ...missingEmbeddingCredentials(config),
    ...(!config.GROQ_API_KEY.trim() ? ["GROQ_API_KEY"] : []),
  ];
}

export const providerKey = (config: Config) => config.GROQ_API_KEY;

export const embeddingModel = (config: Config) => config.VOYAGE_EMBEDDING_MODEL;

export const embeddingDimensions = (config: Config) =>
  config.VOYAGE_EMBEDDING_DIMENSIONS;

export const answerModel = (config: Config) => config.GROQ_ANSWER_MODEL;

export const embeddingIdentity = (config: Config) =>
  `${config.EMBEDDING_PROVIDER}:${embeddingModel(config)}:${embeddingDimensions(config)}:context-chunks-v2`;
