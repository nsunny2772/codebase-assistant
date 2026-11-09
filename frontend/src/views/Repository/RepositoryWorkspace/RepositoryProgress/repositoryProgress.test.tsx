import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { JobStatus } from "@src/enums/JobStatus";
import type { Job } from "@src/models/job.model";
import { RepositoryProgress } from "@src/views/Repository/RepositoryWorkspace/RepositoryProgress/index";

const job: Job = {
  id: "job",
  repoId: "repo",
  status: JobStatus.EMBEDDING,
  files: 2,
  chunks: 10,
  completedChunks: 4,
  warnings: ["Dynamic call unresolved"],
  error: "",
  snapshotId: "s",
  commit: "a".repeat(40),
};
it("allows cancellation only while indexing is active", async () => {
  const cancel = vi.fn();
  const { rerender } = render(
    <RepositoryProgress job={job} onCancel={cancel} cancelling={false} />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Cancel indexing" }),
  );
  expect(cancel).toHaveBeenCalledTimes(1);
  rerender(
    <RepositoryProgress
      job={{ ...job, status: JobStatus.READY }}
      onCancel={cancel}
      cancelling={false}
    />,
  );
  expect(screen.queryByRole("button", { name: "Cancel indexing" })).toBeNull();
  expect(screen.getByText("READY")).toBeTruthy();
});

it("explains a ready run without new chunks and hides empty warnings", () => {
  render(
    <RepositoryProgress
      job={{
        ...job,
        status: JobStatus.READY,
        files: 0,
        chunks: 0,
        completedChunks: 0,
        warnings: [],
      }}
      onCancel={vi.fn()}
      cancelling={false}
    />,
  );
  expect(
    screen.getByText("Repository ready · no new chunks embedded in this run."),
  ).toBeTruthy();
  expect(screen.queryByText(/Indexing warnings/)).toBeNull();
});
