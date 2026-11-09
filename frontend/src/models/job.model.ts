import { alias, list, object, primitive, serializable } from "serializr";

import { JobStatus } from "@src/enums/JobStatus";

export class Job {
  @serializable
  id = "";

  @serializable(alias("repo_id", primitive()))
  repoId = "";

  @serializable
  status = JobStatus.QUEUED;

  @serializable
  files = 0;

  @serializable
  chunks = 0;

  @serializable(alias("completed_chunks", primitive()))
  completedChunks = 0;

  @serializable(list(primitive()))
  warnings: string[] = [];

  @serializable
  error = "";

  @serializable(alias("snapshot_id", primitive()))
  snapshotId = "";

  @serializable
  commit = "";
}

export class JobModel extends Job {}

export class JobListModel {
  @serializable(list(object(JobModel)))
  jobs: JobModel[] = [];
}
