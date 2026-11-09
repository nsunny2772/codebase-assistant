import { EventEmitter } from "node:events";
import type { Response } from "express";
import { it, expect, vi } from "vitest";

import { QuestionController } from "../src/controllers/questions.controller.js";
import type { QuestionService } from "../src/services/questions.service.js";
import type { QuestionRequest } from "../src/routes/http.types.js";
import type { Answer } from "../src/models/index.js";

const makeRequest = () => {
  const raw = new EventEmitter();

  const response = {
    statusCode: 200,
    payload: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return payload;
    },
  };
  return {
    raw,
    request: Object.assign(raw, {
      params: { id: "repo" },
      body: {
        question: "Explain",
        conversation_id: "chat",
        snapshot_id: "snapshot",
      },
    }) as unknown as QuestionRequest,
    response: response as unknown as Response,
    responseMock: response,
  };
};
it("passes request context to the question service and removes completion listeners", async () => {
  const answer: Answer = {
    runId: "run",
    snapshotId: "snapshot",
    commit: "a".repeat(40),
    answer: "No evidence",
    citations: [],
    limitations: [],
    abstained: true,
    usage: { inputTokens: 0, outputTokens: 0 },
    retrievalRounds: 1,
  };

  const service: QuestionService = { ask: vi.fn(async () => answer) },
    controller = QuestionController(service),
    { raw, request, response, responseMock } = makeRequest();
  await controller.askAboutRepository(request, response);
  expect(responseMock.payload).toMatchObject({
    run_id: answer.runId,
    snapshot_id: answer.snapshotId,
    retrieval_rounds: answer.retrievalRounds,
  });
  expect(service.ask).toHaveBeenCalledWith(
    "repo",
    {
      question: request.body.question,
      conversationId: "chat",
      snapshotId: "snapshot",
    },
    expect.any(AbortSignal),
  );
  expect(raw.listenerCount("aborted")).toBe(0);
});
it("forwards client disconnect cancellation and cleans listeners after failure", async () => {
  let signal: AbortSignal | undefined;
  const service: QuestionService = {
    ask: async (_id, _input, requestSignal) => {
      signal = requestSignal;
      return new Promise<Answer>((_resolve, reject) => {
        requestSignal.addEventListener(
          "abort",
          () => reject(new DOMException("Disconnected", "AbortError")),
          { once: true },
        );
      });
    },
  };

  const { raw, request, response } = makeRequest(),
    pending = QuestionController(service).askAboutRepository(request, response);
  expect(raw.listenerCount("aborted")).toBe(1);
  raw.emit("aborted");
  await expect(pending).rejects.toThrow("Disconnected");
  expect(signal?.aborted).toBe(true);
  expect(raw.listenerCount("aborted")).toBe(0);
});
