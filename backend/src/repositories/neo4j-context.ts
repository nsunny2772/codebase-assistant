import type { Driver, QueryResult, ManagedTransaction } from "neo4j-driver";
import { embeddingIdentity, type Config } from "../config/index.js";
import type { Job } from "../models/index.js";
import { AppError } from "../utils/app-error.js";
import { hash } from "../utils/hash.js";

export class Neo4jContext {
  constructor(
    readonly driver: Driver,
    readonly config: Config,
  ) {}

  async query(
    text: string,
    params: Record<string, unknown> = {},
  ): Promise<QueryResult> {
    const session = this.driver.session({
      database: this.config.NEO4J_DATABASE,
    });
    try {
      return await session.executeWrite((tx) => tx.run(text, params), {
        timeout: 10000,
      });
    } finally {
      await session.close();
    }
  }

  async transaction<T>(
    run: (tx: ManagedTransaction) => Promise<T>,
  ): Promise<T> {
    const session = this.driver.session({
      database: this.config.NEO4J_DATABASE,
    });
    try {
      return await session.executeWrite(run, { timeout: 10000 });
    } finally {
      await session.close();
    }
  }

  async owned(tx: ManagedTransaction, job: Job) {
    const result = await tx.run(
      "MATCH (j:IndexJob {id:$id}) SET j.lock=coalesce(j.lock,0)+1 WITH j WHERE j.leaseOwner=$owner AND j.attempt=$attempt AND j.leaseUntil >= $now AND NOT j.status IN ['CANCELLED','FAILED','READY'] RETURN j",
      {
        id: job.id,
        owner: job.leaseOwner,
        attempt: job.attempt,
        now: Date.now(),
      },
    );
    if (!result.records.length)
      throw new AppError(
        "LEASE_LOST",
        "Job ownership expired or the job was cancelled.",
        409,
      );
  }

  get embeddingLabel() {
    return `Embedding_${hash(embeddingIdentity(this.config)).slice(0, 16)}`;
  }

  get vectorIndex() {
    return `ca_vectors_${hash(embeddingIdentity(this.config)).slice(0, 16)}`;
  }

  async read(
    text: string,
    params: Record<string, unknown> = {},
  ): Promise<QueryResult> {
    const session = this.driver.session({
      database: this.config.NEO4J_DATABASE,
    });
    try {
      return await session.executeRead((tx) => tx.run(text, params), {
        timeout: 10000,
      });
    } finally {
      await session.close();
    }
  }

  async capacity() {
    const started = performance.now();

    const nodes = await this.read("MATCH (n) RETURN count(n) AS total");

    const nodeCountMs = performance.now() - started;

    const relationshipStarted = performance.now();

    const relationships = await this.read(
      "MATCH ()-[r]->() RETURN count(r) AS total",
    );

    const relationshipCountMs = performance.now() - relationshipStarted;
    return {
      nodes: Number(nodes.records[0]?.get("total") ?? 0),
      relationships: Number(relationships.records[0]?.get("total") ?? 0),
      nodeLimit: this.config.GRAPH_NODE_LIMIT,
      relationshipLimit: this.config.GRAPH_RELATIONSHIP_LIMIT,
      measurementsMs: {
        nodes: Math.round(nodeCountMs * 100) / 100,
        relationships: Math.round(relationshipCountMs * 100) / 100,
      },
    };
  }

  async heartbeat(workerId: string) {
    await this.query("MERGE (w:WorkerHeartbeat {id:$id}) SET w.lastSeen=$now", {
      id: workerId,
      now: Date.now(),
    });
  }

  async retireWorker(workerId: string) {
    await this.query("MATCH (w:WorkerHeartbeat {id:$id}) DETACH DELETE w", {
      id: workerId,
    });
  }

  async latestWorkerHeartbeat() {
    const result = await this.read(
      "MATCH (w:WorkerHeartbeat) RETURN max(w.lastSeen) AS lastSeen",
    );

    const lastSeen = result.records[0]?.get("lastSeen");
    return typeof lastSeen === "number" ? lastSeen : undefined;
  }

  close() {
    return this.driver.close();
  }
}
