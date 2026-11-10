import { useQuery } from "@tanstack/react-query";
import { deserialize } from "serializr";

import { QueryKey } from "@src/constants/QueryKey";
import { ExploreRepositorySearchModel } from "@src/models/explore.model";
import { API_ROUTES } from "@src/routes/apiRoutes";
import { http as axiosInstance } from "@src/interceptor/interceptor";
import type { ExploreSearchValues } from "@src/shared/types/explore";

export const ExploreService = () => {
  const searchPublicRepositories = (values: ExploreSearchValues) =>
    useQuery({
      queryKey: QueryKey.EXPLORE_REPOSITORIES(
        values.query,
        values.language ?? "",
        values.sort,
        values.page,
      ),
      enabled: values.query.trim().length >= 2,
      staleTime: 300_000,
      gcTime: 600_000,
      queryFn: async () => {
        const response = await axiosInstance.get(
          API_ROUTES.GET_EXPLORE_REPOSITORIES,
          {
            params: {
              query: values.query.trim(),
              language: values.language,
              sort: values.sort,
              page: values.page,
            },
          },
        );
        return deserialize(ExploreRepositorySearchModel, response.data);
      },
    });

  return { searchPublicRepositories };
};
