import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { randomUUID } from "node:crypto";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});
Object.defineProperty(window.crypto, "randomUUID", { value: randomUUID });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
