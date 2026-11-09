import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { vi } from "vitest";

import { normalizeError } from "@src/interceptor/interceptor";
import { http } from "@src/interceptor/interceptor";

type Handler = (path: string, init: RequestInit) => Promise<Response>;

export const mockHttp = (handler: Handler) =>
  vi.spyOn(http, "request").mockImplementation(async (config) => {
    const response = await handler(http.getUri(config), {
      method: config.method?.toUpperCase(),
      headers: config.headers as HeadersInit,
      signal: config.signal as AbortSignal,
      body: config.data ? JSON.stringify(config.data) : undefined,
    });
    const body = await response.text();
    const result = {
      data: body ? JSON.parse(body) : undefined,
      status: response.status,
      statusText: response.statusText,
      headers: {},
      config: config as InternalAxiosRequestConfig,
    };
    if (!response.ok)
      throw normalizeError(
        new AxiosError(
          "Request failed",
          undefined,
          result.config,
          undefined,
          result,
        ),
      );
    return result;
  });
