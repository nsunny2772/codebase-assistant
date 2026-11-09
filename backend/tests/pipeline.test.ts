import { describe, it, expect, vi } from "vitest";
import { MemoryStore } from "./memory-store.js";
import { Indexer, indexRetryDelay } from "../src/services/ingestion/indexer.js";
import { AppError } from "../src/utils/app-error.js";
import { parseConfig } from "../src/config/index.js";
import { parseRepository } from "../src/validations/repository.validation.js";
import {
  answerQuestion,
  validateCitations,
} from "../src/services/workflow/answer.js";
import {
  packEvidence,
  countTokens,
} from "../src/services/retrieval/context.js";
import type { AI } from "../src/services/ai.js";

const config = parseConfig({ GROQ_ANSWER_MODEL: "test-model" });

const signal = () => new AbortController().signal;

function ai(): AI {
  return {
    embed: vi.fn(async (texts) => texts.map(() => [1, 0, 0])),
    generate: vi.fn(async (_q, e) => ({
      result: {
        answer: `Authentication calls validate. [${e[0]!.id}]`,
        evidenceIds: [e[0]!.id],
        limitations: [],
        abstained: false,
      },
      inputTokens: 50,
      outputTokens: 20,
    })),
  };
}

async function indexed() {
  const store = new MemoryStore(),
    provider = ai();

  const { repo } = await store.enqueue(
    parseRepository("https://github.com/test/auth"),
  );

  const job = (await store.claim("worker"))!;

  const source = {
    resolve: async () => "a".repeat(40),
    download: async () => ({
      files: [
        {
          path: "auth.ts",
          text: 'export function validate(token: string) { return token.length > 0; }\nexport function authentication() { return validate("token"); }',
        },
      ],
      warnings: [],
    }),
  };
  await new Indexer(store, source, provider, config).run(job, signal());
  return { store, repo, job, provider };
}
describe("indexing and bounded answering pipeline", () => {
  it("stops before embedding when the per-job token budget is exceeded", async () => {
    const store = new MemoryStore(),
      provider = ai();
    await store.enqueue(parseRepository("https://github.com/a/budget"));
    const job = (await store.claim("budget-worker"))!;

    const limited = parseConfig({ MAX_EMBEDDING_TOKENS_PER_JOB: "1000" });
    await new Indexer(
      store,
      {
        resolve: async () => "a".repeat(40),
        download: async () => ({
          files: [{ path: "README.md", text: "word\n".repeat(3000) }],
          warnings: [],
        }),
      },
      provider,
      limited,
    ).run(job, signal());
    expect(job.status).toBe("FAILED");
    expect(job.error).toBe("JOB_BUDGET");
    expect(provider.embed).not.toHaveBeenCalled();
  });
  it("terminates a pre-cancelled question without generating an answer", async () => {
    const { store, repo, provider } = await indexed();

    const controller = new AbortController();
    controller.abort();
    await expect(
      answerQuestion(
        store,
        provider,
        config,
        repo,
        "authentication",
        "chat",
        repo.activeSnapshot,
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it("indexes, activates, answers with immutable citations, and deletes data", async () => {
    const { store, repo, job, provider } = await indexed();
    expect(job.status).toBe("READY");
    expect(repo.activeSnapshot).toBe(job.snapshotId);
    const answer = await answerQuestion(
      store,
      provider,
      config,
      repo,
      "How does authentication work?",
      "chat",
      repo.activeSnapshot,
      signal(),
    );
    expect(answer.abstained).toBe(false);
    expect(store.readLeases.size).toBe(0);
    expect(answer.citations[0]?.url).toContain(
      `/blob/${"a".repeat(40)}/auth.ts#L`,
    );
    expect(store.answers).toHaveLength(1);
    await store.deleteRepo(repo.id);
    expect(await store.getRepo(repo.id)).toBeUndefined();
    expect(store.answers).toHaveLength(0);
  });
  it("does not replace the last ready snapshot when an embedding request fails", async () => {
    const { store, repo } = await indexed();

    const previous = repo.activeSnapshot;
    await store.enqueue(repo);
    const job = (await store.claim("second"))!;

    const bad = ai();
    bad.embed = async () => {
      throw new Error("provider secret must never persist");
    };
    await new Indexer(
      store,
      {
        resolve: async () => "b".repeat(40),
        download: async () => ({
          files: [{ path: "changed.ts", text: "export const changed = true;" }],
          warnings: [],
        }),
      },
      bad,
      config,
    ).run(job, signal());
    expect(repo.activeSnapshot).toBe(previous);
    expect(job.status).toBe("FAILED");
    expect(job.error).toBe("INDEXING_FAILED");
  });
  it("requeues retryable indexing errors with bounded exponential backoff", async () => {
    const store = new MemoryStore();

    const { job } = await store.enqueue(
      parseRepository("https://github.com/test/retry"),
    );
    await store.claim("retry-worker");
    const active = store.jobs.get(job.id)!;

    const retryConfig = parseConfig({
      GROQ_ANSWER_MODEL: "test-model",
      INDEX_RETRY_BASE_DELAY_MS: "100",
      INDEX_RETRY_MAX_DELAY_MS: "500",
      INDEX_MAX_ATTEMPTS: "3",
    });

    const failed = ai();
    failed.embed = async () => {
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Temporary provider failure.",
        503,
        true,
      );
    };
    const before = Date.now();
    await new Indexer(
      store,
      {
        resolve: async () => "a".repeat(40),
        download: async () => ({
          files: [{ path: "retry.ts", text: "export const retry = true;" }],
          warnings: [],
        }),
      },
      failed,
      retryConfig,
    ).run(active, signal());
    expect(active.status).toBe("QUEUED");
    expect(active.nextAttemptAt).toBeGreaterThanOrEqual(before + 90);
    expect(active.nextAttemptAt).toBeLessThanOrEqual(Date.now() + 100);
    expect(await store.claim("early-worker")).toBeUndefined();
    expect(indexRetryDelay(1, 100, 500)).toBe(100);
    expect(indexRetryDelay(2, 100, 500)).toBe(200);
    expect(indexRetryDelay(5, 100, 500)).toBe(500);
  });
  it("does not retry a transient error after the configured attempt limit", async () => {
    const store = new MemoryStore();

    const { job } = await store.enqueue(
      parseRepository("https://github.com/test/retry-limit"),
    );
    await store.claim("retry-worker");
    const active = store.jobs.get(job.id)!;

    const failed = ai();
    failed.embed = async () => {
      throw new AppError("PROVIDER_LIMIT", "Provider rate limited.", 503, true);
    };
    await new Indexer(
      store,
      {
        resolve: async () => "a".repeat(40),
        download: async () => ({
          files: [{ path: "retry.ts", text: "export const retry = true;" }],
          warnings: [],
        }),
      },
      failed,
      parseConfig({
        GROQ_ANSWER_MODEL: "test-model",
        INDEX_MAX_ATTEMPTS: "1",
      }),
    ).run(active, signal());
    expect(active.status).toBe("FAILED");
    expect(active.nextAttemptAt).toBe(0);
  });
  it("does not activate a cancelled job", async () => {
    const store = new MemoryStore();

    const { repo, job } = await store.enqueue(
      parseRepository("https://github.com/a/b"),
    );
    await store.claim("one");
    await store.cancel(job.id);
    await new Indexer(
      store,
      {
        resolve: async () => "a".repeat(40),
        download: async () => ({ files: [], warnings: [] }),
      },
      ai(),
      config,
    ).run(job, signal());
    expect(repo.activeSnapshot).toBe("");
    expect(job.status).toBe("CANCELLED");
  });
  it("abstains on missing evidence without calling the answer provider", async () => {
    const { store, repo, provider } = await indexed();
    store.search = async () => [];
    const result = await answerQuestion(
      store,
      provider,
      config,
      repo,
      "Where is xyz?",
      "chat",
      repo.activeSnapshot,
      signal(),
    );
    expect(result.abstained).toBe(true);
    expect(provider.generate).not.toHaveBeenCalled();
  });
  it("rejects cross-repository snapshots and fabricated citations", async () => {
    const { store, provider, repo } = await indexed();

    const { repo: other } = await store.enqueue(
      parseRepository("https://github.com/a/other"),
    );
    await expect(
      answerQuestion(
        store,
        provider,
        config,
        other,
        "authentication",
        "chat",
        repo.activeSnapshot,
        signal(),
      ),
    ).rejects.toThrow("Index the repository");
    expect(() => validateCitations(["fabricated"], [])).toThrow(
      "unavailable evidence",
    );
  });
  it("keeps retained snapshot citations on the original commit after refresh", async () => {
    const { store, repo, provider } = await indexed();

    const original = repo.activeSnapshot;
    repo.commit = "b".repeat(40);
    const answer = await answerQuestion(
      store,
      provider,
      config,
      repo,
      "authentication",
      "chat",
      original,
      signal(),
    );
    expect(answer.commit).toBe("a".repeat(40));
  });
  it("enforces context packing and per-job embedding budgets", async () => {
    const { store, repo } = await indexed();

    const chunks = await store.search(
      repo.activeSnapshot,
      "authentication",
      [],
    );

    const packed = packEvidence([...chunks, ...chunks], 10000, 2);
    expect(packed.length).toBeLessThanOrEqual(2);
    expect(countTokens(JSON.stringify(packed))).toBeLessThan(10000);
    expect(packEvidence(chunks, 1)).toEqual([]);
  });
});
