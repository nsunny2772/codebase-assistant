import { expect, it, vi } from "vitest";
import { Neo4jContext } from "../src/repositories/neo4j-context.js";
import { parseConfig } from "../src/config/index.js";

it("reports separate timings for the existing capacity count queries", async () => {
  const context = new Neo4jContext({} as never, parseConfig({}));

  const read = vi
    .spyOn(context, "read")
    .mockResolvedValueOnce({
      records: [{ get: () => 12 }],
    } as never)
    .mockResolvedValueOnce({
      records: [{ get: () => 8 }],
    } as never);

  const result = await context.capacity();

  expect(result).toMatchObject({ nodes: 12, relationships: 8 });
  expect(result.measurementsMs.nodes).toBeGreaterThanOrEqual(0);
  expect(result.measurementsMs.relationships).toBeGreaterThanOrEqual(0);
  expect(read).toHaveBeenNthCalledWith(1, "MATCH (n) RETURN count(n) AS total");
  expect(read).toHaveBeenNthCalledWith(
    2,
    "MATCH ()-[r]->() RETURN count(r) AS total",
  );
});
