import { alias, primitive, serializable } from "serializr";

export class Capacity {
  @serializable
  nodes = 0;

  @serializable
  relationships = 0;

  @serializable(alias("node_limit", primitive()))
  nodeLimit = 0;

  @serializable(alias("relationship_limit", primitive()))
  relationshipLimit = 0;
}

export class CapacityModel extends Capacity {}
