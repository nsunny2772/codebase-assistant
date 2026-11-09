import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import { mockHttp } from "@src/tests/mockHttp";
import { AppRoutes } from "@src/routes";

const HomePage = () =>
  createElement(
    MemoryRouter,
    { initialEntries: ["/"] },
    createElement(AppRoutes),
  );
const repo = {
  id: "repo-id",
  url: "https://github.com/a/b",
  owner: "a",
  name: "b",
  activeSnapshot: "snapshot",
  commit: "a".repeat(40),
};
const job = {
  id: "job-id",
  repoId: repo.id,
  status: "READY",
  files: 2,
  chunks: 3,
  completedChunks: 3,
  warnings: [],
  error: "",
  snapshotId: "snapshot",
  commit: repo.commit,
};
const answer = {
  runId: "run-id",
  snapshotId: "snapshot",
  commit: repo.commit,
  answer: "The handler calls validate. [evidence]",
  citations: [
    {
      id: "evidence",
      path: "auth.ts",
      startLine: 1,
      endLine: 3,
      url: `https://github.com/a/b/blob/${repo.commit}/auth.ts#L1-L3`,
    },
  ],
  limitations: ["Static analysis only."],
  abstained: false,
  usage: { inputTokens: 10, outputTokens: 10 },
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
  new Response(JSON.stringify(toSnakeCase(body)), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const install = (
  options: {
    questionError?: boolean;
    queued?: boolean;
    initiallyEmpty?: boolean;
    multiple?: boolean;
    lookupError?: boolean;
  } = {},
) => {
  let indexed = !options.initiallyEmpty;
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/v1/repositories" && init?.method === "POST") {
      indexed = true;
      return json(
        { repo, job: options.queued ? { ...job, status: "FETCHING" } : job },
        202,
      );
    }
    if (path === `/v1/repositories/${repo.id}/refresh`)
      return json({ repo, job }, 202);
    if (path === "/v1/repositories") {
      if (options.lookupError)
        return json({ message: "Lookup unavailable" }, 503);
      return json({
        repositories: indexed
          ? options.multiple
            ? [
                repo,
                {
                  ...repo,
                  id: "second",
                  owner: "other",
                  name: "project",
                  url: "https://github.com/other/project",
                },
              ]
            : [repo]
          : [],
      });
    }
    if (path === "/v1/capacity")
      return json({
        nodes: 850,
        relationships: 1000,
        nodeLimit: 180000,
        relationshipLimit: 360000,
      });
    if (path === "/v1/repositories/second/jobs") return json({ jobs: [] });
    if (path === `/v1/repositories/${repo.id}/jobs`)
      return json({
        jobs: [options.queued ? { ...job, status: "FETCHING" } : job],
      });
    if (path === `/v1/repositories/${repo.id}/questions`)
      return options.questionError
        ? json({ message: "Provider is unavailable." }, 503)
        : json(answer);
    if (path === `/v1/jobs/${job.id}/cancel`)
      return new Response(null, { status: 204 });
    if (path === `/v1/jobs/${job.id}`) return json({ job });
    throw new Error(`Unexpected request: ${path}`);
  });
  mockHttp(fetch);
  return fetch;
};
describe("repository frontend", () => {
  it("starts without pretending a repository is indexed", () => {
    install({ initiallyEmpty: true });
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(HomePage),
      ),
    );
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Question form" })).toBeNull();
  });
  it("submits a repository and renders an answer with immutable source links", async () => {
    const fetch = install({ initiallyEmpty: true }),
      user = userEvent.setup();
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(HomePage),
      ),
    );
    await user.type(screen.getByPlaceholderText("https://github.com/owner/repository"), repo.url);
    await user.click(screen.getByRole("button", { name: "Index repository" }));
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("How does authentication work?").hasAttribute("disabled"),
      ).toBe(false),
    );
    await user.type(
      screen.getByPlaceholderText("How does authentication work?"),
      "How does authentication work?",
    );
    await user.click(
      screen.getByRole("button", { name: "Ask about this repository" }),
    );
    const source = await screen.findByRole("link", { name: "auth.ts:1–3" });
    expect(source.getAttribute("href")).toBe(answer.citations[0]!.url);
    expect(screen.getByText("The handler calls validate. [1]")).toBeTruthy();
    expect(fetch).toHaveBeenCalled();
  });
  it("shows request errors and preserves the question for retry", async () => {
    install({ questionError: true });
    const user = userEvent.setup();
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(HomePage),
      ),
    );
    await user.click(screen.getByRole("link", { name: "My Repos" }));
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("How does authentication work?").hasAttribute("disabled"),
      ).toBe(false),
    );
    await user.type(
      screen.getByPlaceholderText("How does authentication work?"),
      "Explain login",
    );
    await user.click(
      screen.getByRole("button", { name: "Ask about this repository" }),
    );
    expect(await screen.findByText("Provider is unavailable.")).toBeTruthy();
    expect(
      (screen.getByPlaceholderText("How does authentication work?") as HTMLTextAreaElement)
        .value,
    ).toBe("Explain login");
  });
  it("recovers a persisted active job automatically and allows cancellation", async () => {
    install({ queued: true });
    const user = userEvent.setup();
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(HomePage),
      ),
    );
    await user.click(screen.getByRole("link", { name: "My Repos" }));
    await screen.findByText("FETCHING");
    await user.click(screen.getByRole("button", { name: "Cancel indexing" }));
    expect(await screen.findByText("CANCELLED")).toBeTruthy();
  });
  it("loads the public workspace without sending authorization", async () => {
    const fetch = install();
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(HomePage),
      ),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch.mock.calls.every(([, init]) =>
      !init?.headers || !new Headers(init.headers).has("Authorization"),
    )).toBe(true);
    expect(localStorage.length).toBe(0);
  });
});
it("shows supported stacks and fills an example URL without indexing automatically", async () => {
  const fetch = install();
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(HomePage),
    ),
  );
  await userEvent.click(screen.getByText("Explore a sample repository"));
  expect(
    screen.getByRole("heading", {
      name: "Built for MERN and Python code exploration",
    }),
  ).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: "Use MERN CRUD application example" }),
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "Public GitHub URL",
      }) as HTMLInputElement
    ).value,
  ).toBe("https://github.com/mongodb-developer/mern-stack-example");
  expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
  expect(
    screen
      .getByRole("link", { name: "Flask web application" })
      .getAttribute("href"),
  ).toBe("https://github.com/miguelgrinberg/flasky");
});
it("allows selecting another repository while a durable indexing job is running", async () => {
  install({ queued: true });
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(HomePage),
    ),
  );
  await userEvent.click(screen.getByRole("link", { name: "My Repos" }));
  await screen.findByText("FETCHING");
  expect(
    (screen.getByRole("button", { name: "Open a/b" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("keeps the public repository library available across navigation", async () => {
  const fetch = install(),
    client = new QueryClient(),
    user = userEvent.setup();
  render(
    createElement(QueryClientProvider, { client }, createElement(HomePage)),
  );
  await user.click(screen.getByRole("link", { name: "My Repos" }));
  await waitFor(() =>
    expect(
      (screen.getByPlaceholderText("How does authentication work?") as HTMLTextAreaElement)
        .disabled,
    ).toBe(false),
  );
  await screen.findByText("READY");
  await waitFor(() => expect(client.isFetching()).toBe(0));
  const calls = fetch.mock.calls.length;
  await user.click(screen.getByRole("link", { name: "Dashboard" }));
  await user.click(screen.getByRole("link", { name: "My Repos" }));
  expect(screen.getByRole("form", { name: "Question form" })).toBeTruthy();
  expect(fetch.mock.calls.length).toBe(calls);
  expect(
    client
      .getQueryCache()
      .getAll()
      .some((query) => query.state.data !== undefined),
  ).toBe(true);
  expect(localStorage.length).toBe(0);
});
it("rejects an invalid repository URL before making a mutation request", async () => {
  const fetch = install(),
    user = userEvent.setup();
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(HomePage),
    ),
  );
  await user.type(
    screen.getByPlaceholderText("https://github.com/owner/repository"),
    "https://example.com/a/b",
  );
  await user.click(screen.getByRole("button", { name: "Index repository" }));
  expect(
    await screen.findByText("Use a public GitHub repository URL."),
  ).toBeTruthy();
  expect(
    fetch.mock.calls.some(([, init]) => init?.method === "POST"),
  ).toBe(false);
});

const renderHome = () =>
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(HomePage),
    ),
  );

it("checks existing links before indexing and opens the existing repository without a write", async () => {
  const fetch = install();
  const user = userEvent.setup();
  renderHome();
  await user.type(
    screen.getByPlaceholderText("https://github.com/owner/repository"),
    "https://github.com/A/B.git/",
  );
  await user.click(screen.getByRole("button", { name: "Index repository" }));
  expect(await screen.findByText("Already indexed")).toBeTruthy();
  expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
  await user.click(
    screen.getByRole("button", { name: "Open existing repository" }),
  );
  expect(screen.getByRole("heading", { name: "Ask about a/b" })).toBeTruthy();
  expect(screen.queryByText("Already indexed")).toBeNull();
});

it("requires confirmation before reindexing an existing repository", async () => {
  const fetch = install();
  const user = userEvent.setup();
  renderHome();
  await user.type(screen.getByPlaceholderText("https://github.com/owner/repository"), repo.url);
  await user.click(screen.getByRole("button", { name: "Index repository" }));
  await screen.findByText("Already indexed");
  await user.click(screen.getByRole("button", { name: "Reindex repository" }));
  expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
  await user.click(screen.getByRole("button", { name: "Keep existing index" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
  await user.click(screen.getByRole("button", { name: "Reindex repository" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Reindex repository",
    }),
  );
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([path, init]) => path.endsWith("/refresh") && init?.method === "POST",
      ),
    ).toBe(true),
  );
  expect(
    fetch.mock.calls.some(
      ([path, init]) => path === "/v1/repositories" && init?.method === "POST",
    ),
  ).toBe(false);
});

it("selects an indexed repository from its library card without indexing", async () => {
  const fetch = install({ multiple: true });
  const user = userEvent.setup();
  renderHome();
  await user.click(screen.getByRole("link", { name: "My Repos" }));
  await user.click(
    await screen.findByRole("button", { name: "Open other/project" }),
  );
  expect(
    screen.getByRole("heading", { name: "Ask about other/project" }),
  ).toBeTruthy();
  expect(
    (screen.getByPlaceholderText("How does authentication work?") as HTMLTextAreaElement)
      .disabled,
  ).toBe(false);
  expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
});

it("does not index when the duplicate check fails", async () => {
  const fetch = install({ lookupError: true });
  const user = userEvent.setup();
  renderHome();
  await user.type(screen.getByPlaceholderText("https://github.com/owner/repository"), repo.url);
  await user.click(screen.getByRole("button", { name: "Index repository" }));
  expect(await screen.findByText("Lookup unavailable")).toBeTruthy();
  expect(fetch.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
    false,
  );
});

it("separates Dashboard controls from the My Repos workspace", async () => {
  install({ multiple: true });
  const user = userEvent.setup();
  renderHome();
  await user.click(screen.getByRole("link", { name: "My Repos" }));
  await screen.findByRole("button", { name: "Open other/project" });
  expect(screen.queryByRole("form", { name: "Repository form" })).toBeNull();
  await user.type(screen.getByLabelText("Find a repository"), "other");
  expect(screen.queryByRole("button", { name: "Open a/b" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Open other/project" }));
  expect(
    screen.getByRole("heading", { name: "Ask about other/project" }),
  ).toBeTruthy();
  await user.click(screen.getByRole("link", { name: "Dashboard" }));
  expect(screen.getByRole("form", { name: "Repository form" })).toBeTruthy();
  await user.click(screen.getByRole("link", { name: "My Repos" }));
  expect(screen.queryByRole("form", { name: "Repository form" })).toBeNull();
});

it("supports opening and closing mobile navigation", async () => {
  const user = userEvent.setup();
  renderHome();
  const sidebar = screen.getByRole("complementary", {
    name: "Workspace sidebar",
  });
  await user.click(screen.getByRole("button", { name: "Open sidebar" }));
  expect(sidebar.getAttribute("data-open")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Dismiss sidebar" }));
  expect(sidebar.getAttribute("data-open")).toBe("false");
});

it("requires confirmation before deleting indexed data", async () => {
  const fetch = install();
  const user = userEvent.setup();
  renderHome();
  await user.click(screen.getByRole("link", { name: "My Repos" }));
  await screen.findByRole("button", { name: "Open a/b" });
  await user.click(screen.getByRole("button", { name: "Delete indexed data" }));
  expect(screen.getByRole("dialog", { name: "Delete a/b?" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Keep repository" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(fetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(
    false,
  );
});
