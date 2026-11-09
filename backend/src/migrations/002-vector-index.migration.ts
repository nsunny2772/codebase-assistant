import {
  embeddingDimensions,
  embeddingIdentity,
  type Config,
} from "../config/index.js";
import type { Neo4jMigration } from "./migration.types.js";
import { AppError } from "../utils/app-error.js";
import { indexingStrings } from "../constants/indexing.js";
import { hash } from "../utils/hash.js";

export const createVectorIndexMigration = (config: Config): Neo4jMigration => ({
  id: `002-vector-index-${hash(embeddingIdentity(config)).slice(0, 16)}`,
  async up({ config, embeddingLabel, vectorIndex, run }) {
    const dimensions = embeddingDimensions(config);
    await run(
      `CREATE VECTOR INDEX ${vectorIndex} IF NOT EXISTS FOR (n:${embeddingLabel}) ON (n.embedding) OPTIONS {indexConfig: {\`vector.dimensions\`: ${dimensions}, \`vector.similarity_function\`: 'cosine'}}`,
    );

    const index = await run(
      "SHOW INDEXES YIELD name, options WHERE name=$index RETURN options.indexConfig AS config",
      { index: vectorIndex },
    );

    const indexConfig = index.records[0]?.get("config") as
      Record<string, unknown> | undefined;
    if (!indexConfig || Number(indexConfig["vector.dimensions"]) !== dimensions)
      throw new AppError(
        "INDEX_DIMENSION_MISMATCH",
        indexingStrings.MIGRATION_INDEX_DIMENSION_MISMATCH,
        503,
      );

    const generation = `${embeddingIdentity(config)}:v1`;

    const result = await run(
      "MERGE (g:Budget {id:$generation}) ON CREATE SET g.generation=$generation RETURN g.generation AS generation",
      { generation },
    );
    if (result.records[0]?.get("generation") !== generation)
      throw new AppError(
        "INDEX_GENERATION_MISMATCH",
        indexingStrings.MIGRATION_INDEX_GENERATION_MISMATCH,
        503,
      );

    await run("CALL db.awaitIndex('ca_chunks_text', 8)");
    await run("CALL db.awaitIndex($index, 8)", { index: vectorIndex });
  },
});
