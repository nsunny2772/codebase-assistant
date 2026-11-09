import { alias, primitive, serializable } from "serializr";

export class QuestionBodyModel {
  @serializable
  question = "";

  @serializable(alias("conversation_id", primitive()))
  conversationId = "";

  @serializable(alias("snapshot_id", primitive()))
  snapshotId = "";
}
