import { randomUUID } from "node:crypto";
import type { Driver } from "neo4j-driver";
import type { Config } from "../config/index.js";
import { embeddingIdentity } from "../config/index.js";
import { AppError } from "../utils/app-error.js";
import { commonStrings } from "../constants/common.js";
import { hash } from "../utils/hash.js";
import { coreSchemaMigration } from "./001-core-schema.migration.js";
import { createVectorIndexMigration } from "./002-vector-index.migration.js";
import { operationsMigration } from "./003-operations.migration.js";
import { snapshotReadLeaseMigration } from "./004-snapshot-read-leases.migration.js";
import type { MigrationContext, Neo4jMigration } from "./migration.types.js";

const MIGRATION_LOCK_ID = "global";

const MIGRATION_LOCK_MS = 5 * 60 * 1000;

export class Neo4jMigrationRunner {
  private readonly embeddingLabel: string;

  private readonly vectorIndex: string;

  private readonly migrations: Neo4jMigration[];

  constructor(
    private readonly driver: Driver,
    private readonly config: Config,
  ) {
    const generation = hash(embeddingIdentity(config)).slice(0, 16);
    this.embeddingLabel = `Embedding_${generation}`;
    this.vectorIndex = `ca_vectors_${generation}`;
    this.migrations = [
      coreSchemaMigration,
      createVectorIndexMigration(config),
      operationsMigration,
      snapshotReadLeaseMigration,
    ];
  }

  async run() {
    const session = this.driver.session({
      database: this.config.NEO4J_DATABASE,
    });

    const owner = randomUUID();
    let failure: unknown;
    let failed = false;

    try {
      await this.ensureMigrationConstraints(session);
      await this.acquireLock(session, owner);

      const context: MigrationContext = {
        config: this.config,
        embeddingLabel: this.embeddingLabel,
        vectorIndex: this.vectorIndex,
        run: async (cypher, parameters = {}) => {
          await this.renewLock(session, owner);
          const result = await session.run(cypher, parameters);
          return result;
        },
      };

      for (const migration of this.migrations) {
        if (await this.isApplied(session, migration.id)) continue;

        await migration.up(context);
        await this.renewLock(session, owner);
        await session.executeWrite((transaction) =>
          transaction.run(
            "CREATE (m:SchemaMigration {id:$id, appliedAt:$appliedAt})",
            { id: migration.id, appliedAt: Date.now() },
          ),
        );
      }
    } catch (error) {
      failure = error;
      failed = true;
    }

    try {
      await this.releaseLock(session, owner);
    } catch (error) {
      if (!failed) {
        failure = error;
        failed = true;
      }
    }

    try {
      await session.close();
    } catch (error) {
      if (!failed) {
        failure = error;
        failed = true;
      }
    }

    if (failed) throw failure;
  }

  async status() {
    const session = this.driver.session({
      database: this.config.NEO4J_DATABASE,
    });
    try {
      const result = await session.executeRead((transaction) =>
        transaction.run(
          "MATCH (m:SchemaMigration) WHERE m.id IN $ids RETURN collect(m.id) AS ids",
          { ids: this.migrations.map((migration) => migration.id) },
        ),
      );

      const applied = new Set(
        (result.records[0]?.get("ids") as string[] | undefined) ?? [],
      );
      return this.migrations.every((migration) => applied.has(migration.id));
    } finally {
      await session.close();
    }
  }

  private async ensureMigrationConstraints(
    session: ReturnType<Driver["session"]>,
  ) {
    for (const label of ["SchemaMigration", "SchemaMigrationLock"] as const) {
      await session.run(
        `CREATE CONSTRAINT ca_${label.toLowerCase()}_id IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`,
      );
    }
  }

  private async acquireLock(
    session: ReturnType<Driver["session"]>,
    owner: string,
  ) {
    const now = Date.now();

    const result = await session.executeWrite((transaction) =>
      transaction.run(
        `MERGE (lock:SchemaMigrationLock {id:$id})
         SET lock.serial=coalesce(lock.serial,0)+1
         WITH lock
         WHERE lock.owner IS NULL OR lock.leaseUntil < $now
         SET lock.owner=$owner, lock.leaseUntil=$leaseUntil
         RETURN lock.owner AS owner`,
        {
          id: MIGRATION_LOCK_ID,
          owner,
          now,
          leaseUntil: now + MIGRATION_LOCK_MS,
        },
      ),
    );

    if (result.records[0]?.get("owner") !== owner)
      throw new AppError(
        "MIGRATION_LOCKED",
        commonStrings.MIGRATION_LOCKED,
        503,
        true,
      );
  }

  private async isApplied(
    session: ReturnType<Driver["session"]>,
    migrationId: string,
  ) {
    const result = await session.executeRead((transaction) =>
      transaction.run("MATCH (m:SchemaMigration {id:$id}) RETURN m.id AS id", {
        id: migrationId,
      }),
    );
    return result.records.length > 0;
  }

  private async renewLock(
    session: ReturnType<Driver["session"]>,
    owner: string,
  ) {
    const now = Date.now();

    const result = await session.executeWrite((transaction) =>
      transaction.run(
        `MATCH (lock:SchemaMigrationLock {id:$id, owner:$owner})
         WHERE lock.leaseUntil >= $now
         SET lock.leaseUntil=$leaseUntil
         RETURN lock.owner AS owner`,
        {
          id: MIGRATION_LOCK_ID,
          owner,
          now,
          leaseUntil: now + MIGRATION_LOCK_MS,
        },
      ),
    );

    if (result.records[0]?.get("owner") !== owner)
      throw new AppError(
        "MIGRATION_LOCK_LOST",
        commonStrings.MIGRATION_LOCK_LOST,
        503,
        true,
      );
  }

  private async releaseLock(
    session: ReturnType<Driver["session"]>,
    owner: string,
  ) {
    await session.executeWrite((transaction) =>
      transaction.run(
        "MATCH (lock:SchemaMigrationLock {id:$id, owner:$owner}) SET lock.owner=null, lock.leaseUntil=0",
        { id: MIGRATION_LOCK_ID, owner },
      ),
    );
  }
}
