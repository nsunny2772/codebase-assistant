import {
  AxiosError,
  AxiosHeaders,
  isCancel,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { expect, it, vi } from "vitest";

import { http } from "@src/interceptor/interceptor";

const unavailable = (
  config: InternalAxiosRequestConfig,
  status = 503,
  retryAfter?: string,
) =>
  new AxiosError("Unavailable", "ERR_BAD_RESPONSE", config, undefined, {
    data: { message: "Try later" },
    status,
    statusText: "Unavailable",
    config,
    headers: new AxiosHeaders(retryAfter ? { "retry-after": retryAfter } : {}),
  });

it("retries transient GET failures twice and then succeeds", async () => {
  vi.useFakeTimers();
  let attempts = 0;
  const adapter: AxiosAdapter = async (config) => {
    attempts++;
    if (attempts < 3) throw unavailable(config);
    return {
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  const result = http.get("/test", { adapter });
  await vi.runAllTimersAsync();
  await expect(result).resolves.toMatchObject({ data: { ok: true } });
  expect(attempts).toBe(3);
});

it("bounds retries and normalizes the final error", async () => {
  vi.useFakeTimers();
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    throw unavailable(config);
  });
  const result = http.get("/test", { adapter });
  const assertion = expect(result).rejects.toThrow("Try later");
  await vi.runAllTimersAsync();
  await assertion;
  expect(adapter).toHaveBeenCalledTimes(3);
});

it("never retries mutations or authentication failures", async () => {
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    throw unavailable(config, config.method === "get" ? 401 : 503);
  });
  await expect(http.post("/test", {}, { adapter })).rejects.toThrow(
    "Try later",
  );
  expect(adapter).toHaveBeenCalledTimes(1);
  await expect(http.get("/test", { adapter })).rejects.toThrow("Try later");
  expect(adapter).toHaveBeenCalledTimes(2);
});

it("honors Retry-After and does not shorten a long server delay", async () => {
  vi.useFakeTimers();
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    throw unavailable(config, 429, "2");
  });
  const result = http.get("/test", { adapter });
  const assertion = expect(result).rejects.toThrow("Try later");
  await vi.advanceTimersByTimeAsync(1999);
  expect(adapter).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(adapter).toHaveBeenCalledTimes(2);
  await vi.runAllTimersAsync();
  await assertion;
  const longDelay: AxiosAdapter = async (config) => {
    throw unavailable(config, 429, "120");
  };
  await expect(http.get("/test", { adapter: longDelay })).rejects.toThrow(
    "Try later",
  );
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels pending backoff without another network request", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    throw unavailable(config);
  });
  const result = http.get("/test", { adapter, signal: controller.signal });
  const assertion = result.catch((error) => expect(isCancel(error)).toBe(true));
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await assertion;
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
