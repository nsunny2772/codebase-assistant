import { it, expect, vi } from "vitest";
import { providerFailure, answerInputTokens } from "../src/services/ai.js";
import { GroqService } from "../src/services/groq.js";
import { parseConfig } from "../src/config/index.js";
const config = parseConfig({ GROQ_API_KEY: "test-key" });

const signal = () => new AbortController().signal;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const answer = {
  choices: [
    {
      finish_reason: "stop",
      message: {
        content: JSON.stringify({
          answer: "Insufficient evidence.",
          evidenceIds: [],
          limitations: [],
          abstained: true,
        }),
      },
    },
  ],
  usage: { prompt_tokens: 300, completion_tokens: 20 },
};
it("uses native Groq chat completions with strict structured output", async () => {
  const request = vi.fn(
    async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.groq.com/openai/v1/chat/completions",
      );
      expect(new Headers(options?.headers).get("Authorization")).toBe(
        "Bearer test-key",
      );
      expect(options?.redirect).toBe("error");
      expect(JSON.parse(String(options?.body))).toMatchObject({
        model: "qwen/qwen3.8-27b",
        max_completion_tokens: 4000,
        stream: false,
        response_format: { type: "json_schema", json_schema: { strict: true } },
      });
      return json(answer);
    },
  );
  expect(
    await new GroqService(config, request).generate("q", [], [], signal()),
  ).toMatchObject({
    result: { abstained: true },
    inputTokens: 300,
    outputTokens: 20,
  });
  expect(request).toHaveBeenCalledTimes(1);
});
it("rejects missing keys and oversized context before requests", async () => {
  const request = vi.fn();
  await expect(
    new GroqService(parseConfig({}), request).generate("q", [], [], signal()),
  ).rejects.toThrow("GROQ_API_KEY");
  await expect(
    new GroqService(config, request).generate(
      "query ".repeat(40000),
      [],
      [],
      signal(),
    ),
  ).rejects.toThrow("context budget");
  expect(request).not.toHaveBeenCalled();
});
it("rejects incomplete, refused, missing usage and malformed answers", async () => {
  for (const body of [
    {
      ...answer,
      choices: [{ finish_reason: "length", message: { content: "{}" } }],
    },
    {
      ...answer,
      choices: [
        {
          finish_reason: "stop",
          message: { content: null, refusal: "refused" },
        },
      ],
    },
    {
      ...answer,
      choices: [{ finish_reason: "stop", message: { content: "bad json" } }],
    },
    { ...answer, usage: undefined },
    { ...answer, choices: [] },
  ]) {
    await expect(
      new GroqService(config, async () => json(body)).generate(
        "q",
        [],
        [],
        signal(),
      ),
    ).rejects.toThrow();
  }
});
it("bounds Unicode input by UTF-8 size before making requests", async () => {
  const request = vi.fn();
  await expect(
    new GroqService(config, request).generate(
      "😀".repeat(6000),
      [],
      [],
      signal(),
    ),
  ).rejects.toThrow("context budget");
  expect(request).not.toHaveBeenCalled();
});
it("maps billing, auth, configuration and rate errors without leaking responses", async () => {
  for (const status of [401, 402, 429, 404, 500]) {
    const request = vi.fn(async () => json({ secret: "test-key" }, status));
    await expect(
      new GroqService(config, request).generate("q", [], [], signal()),
    ).rejects.not.toThrow("test-key");
    expect(request).toHaveBeenCalledTimes(1);
  }
  expect(() => providerFailure({ status: 401 })).toThrow("access was denied");
  expect(() => providerFailure({ status: 402 })).toThrow(
    "billing is unavailable",
  );
  try {
    providerFailure({ status: 402 });
  } catch (error) {
    expect(error).toMatchObject({ code: "PROVIDER_BILLING", retryable: false });
  }
  try {
    providerFailure({ status: 429 });
  } catch (error) {
    expect(error).toMatchObject({ code: "PROVIDER_LIMIT", retryable: true });
  }
  expect(() => providerFailure({ status: 404 })).toThrow("configuration");
  expect(() =>
    providerFailure(new DOMException("timeout", "TimeoutError")),
  ).toThrow("deadline");
});

it("uses the same conservative request bound for reservations and context checks", async () => {
  const question = "Describe the exported function.";

  const bound = answerInputTokens(question, [], []);
  expect(bound).toBeGreaterThan(Buffer.byteLength(question));
  const request = vi.fn(async () => json(answer));

  const constrained = {
    ...config,
    MODEL_CONTEXT_TOKENS: bound + config.MAX_OUTPUT_TOKENS + 6000 - 1,
  };
  await expect(
    new GroqService(constrained, request).generate(question, [], [], signal()),
  ).rejects.toThrow("context budget");
  expect(request).not.toHaveBeenCalled();
});
