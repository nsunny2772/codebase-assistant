import { alias, list, object, primitive, serializable } from "serializr";

export class ExploreRepositoryModel {
  @serializable(alias("full_name", primitive()))
  fullName = "";

  @serializable(alias("html_url", primitive()))
  url = "";

  @serializable
  description: string | null = null;

  @serializable
  language: string | null = null;

  @serializable(alias("stargazers_count", primitive()))
  stars = 0;

  @serializable(alias("forks_count", primitive()))
  forks = 0;

  @serializable(alias("updated_at", primitive()))
  updatedAt = "";

}

export class ExploreRepositorySearchModel {
  @serializable(alias("total_count", primitive()))
  totalCount = 0;

  @serializable
  page = 1;

  @serializable(alias("per_page", primitive()))
  perPage = 10;

  @serializable(list(object(ExploreRepositoryModel)))
  repositories: ExploreRepositoryModel[] = [];
}
