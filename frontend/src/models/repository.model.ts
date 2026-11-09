import { alias, list, object, primitive, serializable } from "serializr";

import { JobModel } from "@src/models/job.model";

export class RepositoryBaseModel {
  @serializable
  id = "";

  @serializable
  url = "";

  @serializable
  owner = "";

  @serializable
  name = "";

  @serializable(alias("active_snapshot", primitive()))
  activeSnapshot = "";

  @serializable
  commit = "";
}

export class RepositoryModel extends RepositoryBaseModel {}

export class RepositoryListModel {
  @serializable(list(object(RepositoryModel)))
  repositories: RepositoryModel[] = [];
}

export class RepositoryFileChunkModel {
  @serializable
  path = "";

  @serializable
  chunks = 0;

  @serializable(alias("embedded_chunks", primitive()))
  embeddedChunks = 0;
}

export class RepositoryChunkSummaryModel {
  @serializable(list(object(RepositoryFileChunkModel)))
  files: RepositoryFileChunkModel[] = [];
}

export class IndexResultModel {
  @serializable(object(RepositoryModel))
  repo = new RepositoryModel();

  @serializable(object(JobModel))
  job = new JobModel();
}

export class SubmitRepositoryModel {
  @serializable
  url = "";
}
