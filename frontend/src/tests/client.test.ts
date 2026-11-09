import { AxiosError, CanceledError, type AxiosAdapter } from "axios";
import { expect, it, vi } from "vitest";

import { http } from "@src/interceptor/interceptor";
import { API_BASE_URL, API_TIMEOUT_MS } from "@src/constants/config";
import { API_ROUTES } from "@src/routes/apiRoutes";

it("sends JSON, timeout and cancellation through Axios", async () => {
  const controller = new AbortController();
  const adapter: AxiosAdapter = async (config) => {
    expect(config.headers.get("Authorization")).toBeUndefined();
    expect(config.headers.get("Content-Type")).toBe("application/json");
    expect(config.data).toBe(JSON.stringify({ url: "https://github.com/a/b" }));
    expect(config.timeout).toBe(API_TIMEOUT_MS);
    expect(config.baseURL).toBe(API_BASE_URL);
    expect(config.signal).toBe(controller.signal);
    return {
      data: { id: "repo" },
      status: 201,
      statusText: "Created",
      headers: {},
      config,
    };
  };
  await expect(
    http.post(API_ROUTES.POST_REPOSITORIES, { url: "https://github.com/a/b" }, {
      signal: controller.signal,
      adapter,
    }),
  ).resolves.toMatchObject({ data: { id: "repo" } });
});

it("provides clear timeout and connection errors", async () => {
  const mock = vi.fn();
  mock.mockRejectedValueOnce(new AxiosError("timeout", "ECONNABORTED"));
  await expect(
    http.get(API_ROUTES.GET_REPOSITORIES, { adapter: mock }),
  ).rejects.toThrow("Request timed out");
  mock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
  await expect(
    http.get(API_ROUTES.GET_REPOSITORIES, { adapter: mock }),
  ).rejects.toThrow("Unable to reach the server");
});

it("preserves Axios cancellation", async () => {
  const error = new CanceledError("Cancelled");
  vi.spyOn(http, "request").mockRejectedValueOnce(error);
  await expect(http.get(API_ROUTES.GET_REPOSITORIES)).rejects.toBe(error);
});
