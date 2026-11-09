import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { parseConfig } from "../src/config/index.js";
import { createTestApp } from "./http-test-app.js";

const configured = {
  EMBEDDING_PROVIDER: "voyage",
  LOG_LEVEL: "silent",
  GROQ_API_KEY: "test-key",
  VOYAGE_API_KEY: "test-key",
  NEO4J_URI: "neo4j://localhost",
  NEO4J_PASSWORD: "test-password",
};

describe("configuration and health contract", () => {
  it("rejects invalid ports without echoing credential values", () => {
    expect(() => parseConfig({ PORT: "secret-invalid-value" })).toThrow(
      "Invalid configuration fields: PORT",
    );
  });
  it("rejects unsupported database schemes", () => {
    expect(() => parseConfig({ NEO4J_URI: "https://example.com" })).toThrow(
      "NEO4J_URI",
    );
  });
  it("stays live but does not claim readiness without credentials", async () => {
    const app = await createTestApp(buildApp(parseConfig({ LOG_LEVEL: "silent" })));
    try {
      expect((await app.inject("/health/live")).statusCode).toBe(200);
      const response = await app.inject("/health/ready");
      expect(response.statusCode).toBe(503);
      expect(response.json().reason).toBe("configuration_missing");
    } finally {
      await app.close();
    }
  });
  it("checks database readiness without calling the LLM", async () => {
    let checked = false;
    const app = await createTestApp(buildApp(parseConfig(configured), {
      checkDatabase: async () => {
        checked = true;
      },
      checkOperational: async () => ({
        migrationsReady: true,
        workerReady: true,
      }),
    }));
    try {
      expect((await app.inject("/health/ready")).statusCode).toBe(200);
      expect(checked).toBe(true);
    } finally {
      await app.close();
    }
  });
  it("returns a safe dependency error on database failure", async () => {
    const app = await createTestApp(buildApp(parseConfig(configured), {
      checkDatabase: async () => {
        throw new Error("test-password");
      },
      checkOperational: async () => ({
        migrationsReady: true,
        workerReady: true,
      }),
    }));
    try {
      const response = await app.inject("/health/ready");
      expect(response.statusCode).toBe(503);
      expect(response.body).not.toContain("test-password");
      expect(response.json().reason).toBe("database_unavailable");
    } finally {
      await app.close();
    }
  });
  it("reports worker readiness independently from liveness", async () => {
    const app = await createTestApp(buildApp(parseConfig(configured), {
      checkDatabase: async () => undefined,
      checkOperational: async () => ({
        migrationsReady: true,
        workerReady: false,
        lastWorkerHeartbeat: Date.now() - 60000,
      }),
    }));
    try {
      expect((await app.inject("/health/live")).statusCode).toBe(200);
      const response = await app.inject("/health/ready");
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        reason: "worker_unavailable",
        migrations_ready: true,
        worker_ready: false,
      });
    } finally {
      await app.close();
    }
  });
  it("reports pending migrations without marking the API live as unhealthy", async () => {
    const app = await createTestApp(buildApp(parseConfig(configured), {
      checkDatabase: async () => undefined,
      checkOperational: async () => ({
        migrationsReady: false,
        workerReady: true,
      }),
    }));
    try {
      expect((await app.inject("/health/live")).statusCode).toBe(200);
      const response = await app.inject("/health/ready");
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        reason: "migrations_pending",
        migrations_ready: false,
      });
    } finally {
      await app.close();
    }
  });
});
