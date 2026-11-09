import axios, {
  CanceledError,
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { deserialize } from "serializr";

import {
  API_BASE_URL,
  API_TIMEOUT_MS,
  HTTP_MAX_RETRIES,
  HTTP_MAX_RETRY_DELAY_MS,
  HTTP_RETRY_DELAY_MS,
} from "@src/constants/config";
import { ApiErrorModel } from "@src/models/apiError.model";
import { commonStrings } from "@src/constants/common";

declare module "axios" {
  interface AxiosRequestConfig {
    retryCount?: number;
  }
}

const retryableMethods = new Set(["get", "head"]);
const retryableStatuses = new Set([408, 429, 502, 504]);
const networkErrorCodes = new Set(["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"]);
const timeoutErrorCodes = new Set(["ECONNABORTED", "ETIMEDOUT"]);

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});

let bearerToken: string | undefined;

export const setBearerToken = (token?: string | null) => {
  bearerToken = token?.trim() || undefined;
};

const attachBearerToken = (config: InternalAxiosRequestConfig) => {
  if (bearerToken) {
    config.headers.set("Authorization", `Bearer ${bearerToken}`);
  } else {
    config.headers.delete("Authorization");
  }

  return config;
};

const getRetryDelay = (error: AxiosError): number | undefined => {
  const config = error.config;
  if (
    !config ||
    axios.isCancel(error) ||
    config.signal?.aborted ||
    !retryableMethods.has(config.method?.toLowerCase() ?? "get") ||
    (config.retryCount ?? 0) >= HTTP_MAX_RETRIES
  ) {
    return undefined;
  }

  const status = error.response?.status;
  const networkFailure = !error.response && networkErrorCodes.has(error.code ?? "");
  if (!networkFailure && !retryableStatuses.has(status ?? 0)) {
    return undefined;
  }

  const retryAfter = error.response?.headers?.["retry-after"];
  if (retryAfter !== undefined) {
    const seconds = Number(retryAfter);
    const requestedDelay = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(String(retryAfter)) - Date.now();

    if (Number.isFinite(requestedDelay)) {
      return requestedDelay > HTTP_MAX_RETRY_DELAY_MS
        ? undefined
        : Math.max(0, requestedDelay);
    }
  }

  const backoff =
    HTTP_RETRY_DELAY_MS *
    2 ** (config.retryCount ?? 0) *
    (0.75 + Math.random() * 0.5);

  return Math.min(HTTP_MAX_RETRY_DELAY_MS, backoff);
};

const waitForRetry = (delay: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CanceledError(commonStrings.COMMON.CANCELLED));
      return;
    }

    const cleanup = () => signal?.removeEventListener("abort", cancel);
    const finish = () => {
      cleanup();
      resolve();
    };
    const cancel = () => {
      clearTimeout(timer);
      cleanup();
      reject(new CanceledError(commonStrings.COMMON.CANCELLED));
    };
    const timer = setTimeout(finish, delay);

    signal?.addEventListener("abort", cancel, { once: true });
  });

export const normalizeError = (error: unknown): unknown => {
  if (!axios.isAxiosError(error) || axios.isCancel(error)) {
    return error;
  }

  const responseData = error.response?.data;
  let apiMessage: string | undefined;
  if (
    responseData &&
    typeof responseData === "object" &&
    typeof responseData.message === "string"
  ) {
    try {
      apiMessage = deserialize(ApiErrorModel, responseData).message;
    } catch {
      // Fall back to a stable client-side message when the error payload is malformed.
    }
  }

  const message = apiMessage?.trim()
    ? apiMessage
    : error.response
      ? commonStrings.COMMON.HTTP_FAILURE(error.response.status)
      : timeoutErrorCodes.has(error.code ?? "")
        ? commonStrings.COMMON.REQUEST_TIMED_OUT
        : commonStrings.COMMON.SERVER_UNAVAILABLE;

  return new Error(message, { cause: error });
};

const handleResponseError = async (error: unknown): Promise<AxiosResponse> => {
  if (axios.isAxiosError(error)) {
    const delay = getRetryDelay(error);
    if (delay !== undefined && error.config) {
      await waitForRetry(
        delay,
        error.config.signal as AbortSignal | undefined,
      );
      error.config.retryCount = (error.config.retryCount ?? 0) + 1;
      return http.request(error.config);
    }
  }

  throw normalizeError(error);
};

http.interceptors.request.use(attachBearerToken);
http.interceptors.response.use(undefined, handleResponseError);

export default http;
