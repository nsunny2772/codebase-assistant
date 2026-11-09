import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AppRoutes } from "@src/routes/index";
import { mockHttp } from "@src/tests/mockHttp";

it("loads Home and fetches the public repository list", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ repositories: [] }), { status: 200 }));
  mockHttp(fetch);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(
    screen.getByRole("heading", { name: "AI Codebase Assistant" }),
  ).toBeTruthy();
  expect(screen.getByPlaceholderText("https://github.com/owner/repository")).toBeTruthy();
  expect(
    screen.getAllByRole("heading", { name: "AI Codebase Assistant" }),
  ).toHaveLength(1);
  await screen.findByRole("form", { name: "Repository form" });
  expect(fetch).toHaveBeenCalledWith("/v1/repositories", expect.anything());
});
it("shows a fallback route and navigates back to Home", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/missing"]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
  await userEvent.click(screen.getByRole("link", { name: "Back to Home" }));
  expect(await screen.findByLabelText("Public GitHub URL")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Page not found" })).toBeNull();
  expect(
    screen.getAllByRole("heading", { name: "AI Codebase Assistant" }),
  ).toHaveLength(1);
});
