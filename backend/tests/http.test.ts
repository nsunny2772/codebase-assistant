import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { parseConfig } from "../src/config/index.js";
import { MemoryStore } from "./memory-store.js";
import type { AI } from "../src/services/ai.js";
import { createTestApp } from "./http-test-app.js";

const ai: AI = {
  embed: async (texts) => texts.map(() => [1, 0, 0]),
  generate: async () => {
    throw new Error("Not used");
  },
};

const config = parseConfig({ LOG_LEVEL: "silent" });

const headers = {};
describe("repository API contracts", () => {
  it("publishes the request contract and capacity counters", async () => {
    const app = await createTestApp(buildApp(config, { store: new MemoryStore(), ai }));
    try {
      const schema = await app.inject({ url: "/v1/openapi.json", headers });
      expect(schema.statusCode).toBe(200);
      expect(
        schema.json().paths["/v1/repositories/{id}/questions"],
      ).toBeTruthy();
      const capacity = await app.inject({ url: "/v1/capacity", headers });
      expect(capacity.json().node_limit).toBe(180000);
      expect(capacity.json().relationship_limit).toBe(360000);
    } finally {
      await app.close();
    }
  });
  it("allows public API access and does not trust forwarded origins", async () => {
    const app = await createTestApp(buildApp(config, { store: new MemoryStore(), ai }));
    try {
      expect((await app.inject("/v1/repositories")).statusCode).toBe(200);
      const denied = await app.inject({
        url: "/v1/repositories",
        headers: {
          ...headers,
          origin: "https://evil.example",
          "x-forwarded-host": "evil.example",
        },
      });
      expect(denied.statusCode).toBe(403);
      expect(
        (
          await app.inject({
            url: "/v1/repositories",
            headers: { ...headers, origin: "http://127.0.0.1:5173" },
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      await app.close();
    }
  });
  it("accepts matching local frontend hosts through the development proxy", async () => {
    const app = await createTestApp(buildApp(config, { store: new MemoryStore(), ai }));
    try {
      for (const host of ["localhost:5173", "127.0.0.1:5173"]) {
        const response = await app.inject({
          url: "/v1/repositories",
          headers: { ...headers, host, origin: `http://${host}` },
        });
        expect(response.statusCode).toBe(200);
      }
      const denied = await app.inject({
        url: "/v1/repositories",
        headers: {
          ...headers,
          host: "localhost:5173",
          origin: "https://evil.example",
        },
      });
      expect(denied.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
  it("submits idempotently, reports jobs without leases, cancels and deletes", async () => {
    const app = await createTestApp(buildApp(config, { store: new MemoryStore(), ai }));
    try {
      const submit = () =>
        app.inject({
          method: "POST",
          url: "/v1/repositories",
          headers,
          payload: { url: "https://github.com/a/b" },
        });

      const first = await submit(),
        again = await submit();
      expect(first.statusCode).toBe(202);
      expect(again.json().job.id).toBe(first.json().job.id);
      const { repo, job } = first.json();

      const status = await app.inject({ url: `/v1/jobs/${job.id}`, headers });
      expect(status.json().job.leaseOwner).toBeUndefined();
      expect(
        (
          await app.inject({
            method: "POST",
            url: `/v1/jobs/${job.id}/cancel`,
            headers,
          })
        ).statusCode,
      ).toBe(204);
      expect(
        (await app.inject({ url: `/v1/jobs/${job.id}`, headers })).json().job
          .status,
      ).toBe("CANCELLED");
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: `/v1/repositories/${repo.id}`,
            headers,
          })
        ).statusCode,
      ).toBe(204);
      expect(
        (await app.inject({ url: `/v1/repositories/${repo.id}`, headers }))
          .statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });
  it("validates URLs and request schemas without accepting arbitrary hosts", async () => {
    const app = await createTestApp(buildApp(config, { store: new MemoryStore(), ai }));
    try {
      const invalid = await app.inject({
        method: "POST",
        url: "/v1/repositories",
        headers,
        payload: { url: "https://localhost/internal" },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().code).toBe("INVALID_REPOSITORY");
      const extra = await app.inject({
        method: "POST",
        url: "/v1/repositories",
        headers,
        payload: { url: "https://github.com/a/b", secret: "ignored" },
      });
      // Unknown request properties are stripped before reaching the store.
      expect(extra.statusCode).toBe(202);
    } finally {
      await app.close();
    }
  });
  it("returns a safe 503 when dependencies are not configured", async () => {
    const app = await createTestApp(buildApp(config));
    try {
      const result = await app.inject({ url: "/v1/repositories", headers });
      expect(result.statusCode).toBe(503);
      expect(result.json().code).toBe("SERVICE_NOT_CONFIGURED");
    } finally {
      await app.close();
    }
  });
});
