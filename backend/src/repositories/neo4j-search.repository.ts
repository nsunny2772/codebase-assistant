import { fuse } from "../services/retrieval/context.js";
import { chunkFrom } from "./neo4j-mapping.js";
import { Neo4jContext } from "./neo4j-context.js";

export class Neo4jSearchRepository {
  constructor(private readonly db: Neo4jContext) {}

  async search(snapshot: string, query: string, vector?: number[]) {
    const words = query.match(/[\p{L}\p{N}_]{2,}/gu)?.slice(0, 12) ?? [];
    if (!words.length) return [];
    const exact = await this.db.read(
      "MATCH (c:CodeChunk {snapshotId:$snapshot}) WHERE any(term IN $terms WHERE toLower(c.name)=term OR toLower(c.path) CONTAINS term) RETURN c LIMIT 20",
      { snapshot, terms: words.map((w) => w.toLowerCase()) },
    );

    // Bounded over-fetch for shared indexes, followed by mandatory scope filtering.
    const text = await this.db.read(
      "CALL db.index.fulltext.queryNodes('ca_chunks_text', $query, {limit:200}) YIELD node,score WHERE node.snapshotId=$snapshot RETURN node AS c,score LIMIT 20",
      { snapshot, query: words.map((w) => `"${w}"`).join(" OR ") },
    );

    const results = [exact, text];
    if (vector?.length) {
      results.push(
        await this.db.read(
          "CALL db.index.vector.queryNodes($index,200,$vector) YIELD node,score WHERE node.snapshotId=$snapshot RETURN node AS c,score LIMIT 20",
          { snapshot, vector, index: this.db.vectorIndex },
        ),
      );
    }
    return fuse(
      results.map((result) =>
        result.records.map((r) => chunkFrom(r.get("c").properties)),
      ),
    );
  }

  async neighbors(snapshot: string, ids: string[]) {
    const result = await this.db.read(
      "MATCH (c:CodeChunk) WHERE c.id IN $ids AND c.snapshotId=$snapshot MATCH (s:Symbol)-[:HAS_CHUNK]->(c) MATCH (s)-[:CALLS|IMPORTS]-(other:Symbol) WHERE other.snapshotId=$snapshot WITH DISTINCT other LIMIT 20 MATCH (other)-[:HAS_CHUNK]->(n:CodeChunk) WHERE n.snapshotId=$snapshot RETURN DISTINCT n LIMIT 30",
      { snapshot, ids },
    );
    return result.records.map((r) => chunkFrom(r.get("n").properties, 0.005));
  }

  async symbols(snapshot: string, name: string) {
    return (
      await this.db.read(
        "MATCH (s:Symbol {snapshotId:$snapshot}) WHERE toLower(s.name) CONTAINS toLower($name) RETURN s.id AS id,s.name AS name,s.path AS path,s.scope AS scope,s.startLine AS startLine LIMIT 30",
        { snapshot, name },
      )
    ).records.map(
      (r) =>
        r.toObject() as {
          id: string;
          name: string;
          path: string;
          scope: string;
          startLine: number;
        },
    );
  }
}
