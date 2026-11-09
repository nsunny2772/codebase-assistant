import { AppError } from "../utils/app-error.js";
import { hash } from "../utils/hash.js";
import { Neo4jContext } from "./neo4j-context.js";

export class Neo4jBudgetRepository {
  constructor(private readonly db: Neo4jContext) {}

  async reserve(kind: "embedding" | "answer", tokens: number) {
    const id = hash(`${kind}:${new Date().toISOString().slice(0, 10)}`);

    const limit =
      kind === "embedding"
        ? this.db.config.DAILY_EMBEDDING_TOKEN_LIMIT
        : this.db.config.DAILY_ANSWER_TOKEN_LIMIT;
    await this.db.transaction(async (tx) => {
      const result = await tx.run(
        "MERGE (b:Budget {id:$id}) ON CREATE SET b.used=0 SET b.used=coalesce(b.used,0)+$tokens RETURN b.used AS used",
        { id, tokens },
      );
      if (Number(result.records[0]?.get("used")) > limit)
        throw new AppError(
          "DAILY_BUDGET",
          "Daily provider token budget exhausted. Try again tomorrow.",
          429,
        );
    });
  }
}
