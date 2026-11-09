import { alias, list, object, primitive, serializable } from "serializr";

export class CitationModel {
  @serializable
  id = "";

  @serializable
  path = "";

  @serializable(alias("start_line", primitive()))
  startLine = 0;

  @serializable(alias("end_line", primitive()))
  endLine = 0;

  @serializable
  url = "";
}

export class UsageModel {
  @serializable(alias("input_tokens", primitive()))
  inputTokens = 0;

  @serializable(alias("output_tokens", primitive()))
  outputTokens = 0;
}

export class Answer {
  @serializable(alias("run_id", primitive()))
  runId = "";

  @serializable(alias("snapshot_id", primitive()))
  snapshotId = "";

  @serializable
  commit = "";

  @serializable
  answer = "";

  @serializable(list(object(CitationModel)))
  citations: CitationModel[] = [];

  @serializable(list(primitive()))
  limitations: string[] = [];

  @serializable
  abstained = false;

  @serializable(object(UsageModel))
  usage = new UsageModel();
}

export class AnswerModel extends Answer {}
