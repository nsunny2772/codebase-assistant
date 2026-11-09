import { it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, useQueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { http } from "@src/interceptor/interceptor";
import { API_ROUTES } from "@src/routes/apiRoutes";
import { RepositoryService } from "@src/services/repository.service";
import { useJobCompletion } from "@src/hooks/useJobCompletion";
import { mockHttp } from "@src/tests/mockHttp";

import { QueryKey } from "@src/constants/QueryKey";
import { JobStatus } from "@src/enums/JobStatus";

vi.mock("@src/constants/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@src/constants/config")>()),
  JOB_POLL_INTERVAL_MS: 25,
}));

const useRepositoryQueries = () => {
  const client = useQueryClient();
  const service = RepositoryService();
  const repositories = service.getReposList();
  const capacity = service.getCapacity();
  const repoId = repositories.data?.repositories?.[0]?.id;
  const jobs = service.getJobs(repoId);
  useJobCompletion(jobs.data?.jobs?.[0], true, client);
  return { repositories, capacity, jobs };
};
const useRepositoryMutations = () => {
  const service = RepositoryService();
  const remove = service.deleteRepository();
  const ask = service.askAboutRepository();
  return { remove, ask };
};
const toSnakeCase = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      toSnakeCase(entry),
    ]),
  );
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(toSnakeCase(body)), { status });
const repository = {
  id: "one",
  url: "https://github.com/a/one",
  owner: "a",
  name: "one",
  activeSnapshot: "s",
  commit: "a".repeat(40),
};
const job = {
  id: "job",
  repoId: "one",
  status: JobStatus.FETCHING,
  files: 2,
  chunks: 3,
  completedChunks: 0,
  warnings: [],
  error: "",
  snapshotId: "s",
  commit: repository.commit,
};
const setup = () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};
it("polls active jobs, stops on completion and refreshes repository data", async () => {
  let reads = 0,
    lists = 0;
  mockHttp(
    vi.fn(async (path: string) => {
      if (path === "/v1/repositories") {
        lists++;
        return json({ repositories: [repository] });
      }
      if (path === "/v1/capacity")
        return json({
          nodes: 1,
          relationships: 1,
          nodeLimit: 100,
          relationshipLimit: 100,
        });
      if (path.endsWith("/jobs")) {
        reads++;
        return json({
          jobs: [{ ...job, status: reads === 1 ? JobStatus.FETCHING : JobStatus.READY }],
        });
      }
      throw new Error("Unexpected endpoint");
    }),
  );
  const { wrapper } = setup();
  const { result } = renderHook(() => useRepositoryQueries(), {
    wrapper,
  });
  await waitFor(() =>
    expect(result.current.jobs.data?.jobs[0]?.status).toBe(JobStatus.READY),
  );
  await waitFor(() => expect(lists).toBeGreaterThanOrEqual(2));
  const completedReads = reads;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  expect(reads).toBe(completedReads);
});
it("stops polling on an API error without retrying it repeatedly", async () => {
  let reads = 0;
  mockHttp(
    vi.fn(async (path: string) => {
      if (path === "/v1/repositories")
        return json({ repositories: [repository] });
      if (path === "/v1/capacity") return json({ nodes: 1 });
      reads++;
      return json({ message: "Database unavailable" }, 503);
    }),
  );
  const { wrapper } = setup();
  const { result } = renderHook(() => useRepositoryQueries(), {
    wrapper,
  });
  await waitFor(() =>
    expect(result.current.jobs.error?.message).toBe("Database unavailable"),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(reads).toBe(1);
});
it("removes deleted repository caches while preserving other repositories", async () => {
  const { client, wrapper } = setup(),
    keys = QueryKey,
    other = { ...repository, id: "two" };
  client.setQueryData(keys.REPOSITORIES, { repositories: [repository, other] });
  client.setQueryData(keys.JOBS("one"), { jobs: [job] });
  client.setQueryData(keys.JOBS("two"), { jobs: [] });
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  mockHttp(fetch);
  const { result } = renderHook(
    () => useRepositoryMutations(),
    { wrapper },
  );
  await act(async () => {
    await result.current.remove.mutateAsync("one");
  });
  expect(client.getQueryData(keys.REPOSITORIES)).toEqual({
    repositories: [other],
  });
  expect(client.getQueryData(keys.JOBS("one"))).toBeUndefined();
  expect(client.getQueryData(keys.JOBS("two"))).toEqual({ jobs: [] });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("never retries an answer mutation automatically", async () => {
  const request = vi.fn(async () => json({ message: "Rate limited" }, 503));
  mockHttp(request);
  const { wrapper } = setup();
  const { result } = renderHook(
    () => useRepositoryMutations(),
    { wrapper },
  );
  await act(async () => {
    await expect(
      result.current.ask.mutateAsync({
        repoId: "one",
        question: "Explain",
        conversationId: "chat",
        snapshotId: "s",
      }),
    ).rejects.toThrow("Rate limited");
  });
  expect(request).toHaveBeenCalledTimes(1);
});
it("fetches query data without passing an AbortSignal", async () => {
  const handler = vi.fn(async (path: string, options: RequestInit) => {
    expect(options.signal).toBeUndefined();
    return json(
      path === "/v1/repositories" ? { repositories: [] } : { nodes: 1 },
    );
  });
  mockHttp(handler);
  const { wrapper } = setup();
  const { result } = renderHook(() => useRepositoryQueries(), {
    wrapper,
  });
  await waitFor(() => expect(result.current.repositories.isSuccess).toBe(true));
  expect(handler).toHaveBeenCalledTimes(2);
});
it("falls back to a safe HTTP error for a null error response", async () => {
  mockHttp(vi.fn(async () => new Response("null", { status: 503 })));
  await expect(http.get(API_ROUTES.GET_REPOSITORIES)).rejects.toThrow(
    "Request failed (503)",
  );
});
