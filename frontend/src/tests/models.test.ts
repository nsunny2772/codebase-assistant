import { deserialize, serialize } from "serializr";
import { expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { AnswerModel, CitationModel, UsageModel } from "@src/models/answer.model";
import { RepositoryListModel, RepositoryModel } from "@src/models/repository.model";
import { QuestionBodyModel } from "@src/models/question.model";
import { RepositoryService } from "@src/services/repository.service";
import { http } from "@src/interceptor/interceptor";
import { mockHttp } from "@src/tests/mockHttp";

it("deserializes nested answer data and serializes it back to the API shape", () => {
  const data = {
    run_id: "run",
    snapshot_id: "snapshot",
    commit: "commit",
    answer: "Answer",
    citations: [
      {
        id: "c",
        path: "app.py",
        start_line: 1,
        end_line: 2,
        url: "https://github.com/a/b",
      },
    ],
    limitations: [],
    abstained: false,
    usage: { input_tokens: 4, output_tokens: 8 },
  };
  const result = deserialize(AnswerModel, data);
  expect(result).toBeInstanceOf(AnswerModel);
  expect(result.citations[0]).toBeInstanceOf(CitationModel);
  expect(result.usage).toBeInstanceOf(UsageModel);
  expect(serialize(AnswerModel, result)).toEqual(data);
});

it("maps response lists and omits fields outside the schema", () => {
  const result = deserialize(RepositoryListModel, {
    repositories: [{ id: "one", unexpected: "private" }],
  });
  expect(result.repositories[0]).toBeInstanceOf(RepositoryModel);
  expect(result.repositories[0]?.id).toBe("one");
  expect(result.repositories[0]).not.toHaveProperty("unexpected");
  expect(result.repositories[0]?.name).toBe("");
  const input = {
    question: "Explain",
    conversationId: "chat",
    snapshotId: "s",
    repoId: "omit",
    token: "omit",
  };
  expect(serialize(QuestionBodyModel, input)).toEqual({
    question: "Explain",
    conversation_id: "chat",
    snapshot_id: "s",
  });
});

it("serializes question bodies at the API boundary and deserializes responses", async () => {
  const handler = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          answer: "Mapped",
          citations: [],
          limitations: [],
          usage: { input_tokens: 1, output_tokens: 2 },
        }),
        { status: 200 },
      ),
  );
  mockHttp(handler);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result: hook } = renderHook(() => {
    const service = RepositoryService();
    return service.askAboutRepository();
  }, { wrapper });
  let result;
  await act(async () => {
    result = await hook.current.mutateAsync({
      repoId: "one",
      question: "Explain",
      conversationId: "chat",
      snapshotId: "s",
    });
  });
  expect(result).toBeInstanceOf(AnswerModel);
  expect(handler.mock.calls[0]).toBeDefined();
  expect(vi.mocked(http.request).mock.calls[0]?.[0]?.data).toEqual({
    question: "Explain",
    conversation_id: "chat",
    snapshot_id: "s",
  });
});

it("rejects missing JSON responses and accepts bodyless 204 responses", async () => {
  mockHttp(async () => new Response(null, { status: 204 }));
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result } = renderHook(() => {
    const service = RepositoryService();
    return {
      repositories: service.getReposList(),
      remove: service.deleteRepository(),
    };
  }, { wrapper });
  await expect(result.current.remove.mutateAsync("one")).resolves.toBeUndefined();
  await expect(result.current.repositories.refetch()).resolves.toMatchObject({
    isError: true,
    error: expect.objectContaining({ message: expect.stringContaining("invalid response") }),
  });
});
