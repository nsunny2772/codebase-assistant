import type { Answer } from "../models/index.js";
import { Neo4jContext } from "./neo4j-context.js";

export class Neo4jConversationRepository {
  constructor(private readonly db: Neo4jContext) {}

  async history(repo: string, snapshot: string, conversation: string) {
    const result = await this.db.read(
      "MATCH (q:QueryRun {repoId:$repo,snapshotId:$snapshot,conversation:$conversation}) RETURN q.question AS question,q.answer AS answer ORDER BY q.createdAt DESC LIMIT 3",
      { repo, snapshot, conversation },
    );
    return result.records
      .map((r) => ({
        question: String(r.get("question")),
        answer: String(r.get("answer")),
      }))
      .reverse();
  }

  async recordAnswer(
    repo: string,
    conversation: string,
    question: string,
    answer: Answer,
  ) {
    await this.db.query(
      "MATCH (r:Repository {id:$repo}) WHERE r.deletedAt IS NULL CREATE (q:QueryRun {id:$id,repoId:$repo,snapshotId:$snapshot,conversation:$conversation,question:$question,answer:$answer,result:$result,createdAt:$now})",
      {
        id: answer.runId,
        repo,
        snapshot: answer.snapshotId,
        conversation,
        question,
        answer: answer.answer,
        result: JSON.stringify(answer),
        now: Date.now(),
      },
    );
  }
}
