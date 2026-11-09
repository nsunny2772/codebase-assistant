import { deserialize } from "serializr";
import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { AnswerModel } from "@src/models/answer.model";
import type { AnswerMessage } from "@src/shared/types/ui";
import { AnswerList } from "@src/views/Repository/RepositoryWorkspace/AnswerList/index";

it("renders numbered evidence with commit-pinned source links and uncertainty", () => {
  const commit = "a".repeat(40),
    url = `https://github.com/a/b/blob/${commit}/app.py#L2-L5`;
  const messages: AnswerMessage[] = [
    {
      question: "Where is validation?",
      result: {
        runId: "run",
        snapshotId: "snapshot",
        commit,
        answer: "Inspect the function [evidence].",
        citations: [
          { id: "evidence", path: "app.py", startLine: 2, endLine: 5, url },
        ],
        abstained: true,
        limitations: ["Dynamic calls unresolved"],
        usage: { inputTokens: 10, outputTokens: 20 },
      },
    },
  ];
  render(<AnswerList messages={messages} ready />);
  expect(
    screen.getByRole("link", { name: "app.py:2–5" }).getAttribute("href"),
  ).toBe(url);
  expect(screen.getByText("Inspect the function [1].")).toBeTruthy();
  expect(screen.getByText("Limited evidence")).toBeTruthy();
});
it("shows clear fallbacks when an answer response is incomplete", () => {
  const messages: AnswerMessage[] = [{
    question: "Explain this repository",
    result: deserialize(AnswerModel, {}),
  }];
  render(<AnswerList messages={messages} ready />);
  expect(screen.getByText("Answer unavailable.")).toBeTruthy();
  expect(screen.getByText(/Commit Unavailable/)).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});
