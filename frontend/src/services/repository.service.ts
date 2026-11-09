import { useMutation, useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { generatePath } from "react-router-dom";
import { deserialize, serialize } from "serializr";

import { QueryKey } from "@src/constants/QueryKey";
import { JOB_POLL_INTERVAL_MS, TERMINAL_JOB_STATUSES } from "@src/constants/config";
import { JobStatus } from "@src/enums/JobStatus";
import { AnswerModel } from "@src/models/answer.model";
import { CapacityModel } from "@src/models/capacity.model";
import { JobListModel } from "@src/models/job.model";
import { QuestionBodyModel } from "@src/models/question.model";
import {
  IndexResultModel,
  RepositoryChunkSummaryModel,
  RepositoryListModel,
  SubmitRepositoryModel,
} from "@src/models/repository.model";
import { API_ROUTES } from "@src/routes/apiRoutes";
import { http as axiosInstance } from "@src/interceptor/interceptor";
import type { Job } from "@src/models/job.model";
import type { Repository } from "@src/shared/types/repository";

export interface QuestionInput {
  repoId: string;
  question: string;
  conversationId: string;
  snapshotId: string;
}

type JobsResponse = JobListModel;
type RepositoryList = RepositoryListModel;
type CancelInput = { jobId: string; repoId: string };

const getPollingInterval = (query: Query<JobsResponse>) => {
  const job = query.state.data?.jobs[0];
  return query.state.error || !job || TERMINAL_JOB_STATUSES.includes(job.status)
    ? false
    : JOB_POLL_INTERVAL_MS;
};

export const RepositoryService = () => {
  const queryClient = useQueryClient();
  const invalidateRepositories = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: QueryKey.REPOSITORIES }),
    queryClient.invalidateQueries({ queryKey: QueryKey.CAPACITY }),
  ]);

  const seedIndexResult = ({ repo, job }: { repo?: Repository; job: Job }) => {
    if (repo) {
      const update = (old: RepositoryList | undefined) => ({
        repositories: [repo, ...(old?.repositories ?? []).filter((item) => item.id !== repo.id)],
      });
      queryClient.setQueryData<RepositoryList>(QueryKey.REPOSITORIES, update);
    }
    queryClient.setQueryData(QueryKey.JOBS(job.repoId), { jobs: [job] });
  };

  const handleIndexSuccess = async (data: { repo?: Repository; job: Job }) => {
    seedIndexResult(data);
    await Promise.all([
      invalidateRepositories(),
      queryClient.invalidateQueries({ queryKey: QueryKey.CHUNKS(data.job.repoId) }),
    ]);
  };

  const getReposList = () =>
    useQuery({
      queryKey: QueryKey.REPOSITORIES,
      queryFn: async () => {
        const response = await axiosInstance.get(API_ROUTES.GET_REPOSITORIES);
        return deserialize(RepositoryListModel, response.data);
      },
    });

  const getCapacity = (enabled = true) =>
    useQuery({
      queryKey: QueryKey.CAPACITY,
      enabled,
      queryFn: async () => {
        const response = await axiosInstance.get(API_ROUTES.GET_CAPACITY);
        return deserialize(CapacityModel, response.data);
      },
    });

  const getJobs = (repoId?: string) =>
    useQuery({
      queryKey: QueryKey.JOBS(repoId ?? ""),
      queryFn: async () => {
        const response = await axiosInstance.get(
          generatePath(API_ROUTES.GET_REPOSITORY_JOBS, { repoId: repoId ?? "" }),
        );
        return deserialize(JobListModel, response.data);
      },
      enabled: Boolean(repoId),
      refetchInterval: getPollingInterval,
    });

  const getChunkSummary = (repoId?: string) =>
    useQuery({
      queryKey: QueryKey.CHUNKS(repoId ?? ""),
      enabled: Boolean(repoId),
      queryFn: async () => {
        const response = await axiosInstance.get(
          generatePath(API_ROUTES.GET_REPOSITORY_CHUNKS, { repoId: repoId ?? "" }),
        );
        return deserialize(RepositoryChunkSummaryModel, response.data);
      },
    });

  const addRepository = () =>
    useMutation({
      mutationFn: async (url: string) => {
        const body = serialize(SubmitRepositoryModel, { url });
        const response = await axiosInstance.post(API_ROUTES.POST_REPOSITORIES, body);
        return deserialize(IndexResultModel, response.data);
      },
      onSuccess: handleIndexSuccess,
    });

  const reindexRepository = () =>
    useMutation({
      mutationFn: async (repoId: string) => {
        const response = await axiosInstance.post(
          generatePath(API_ROUTES.POST_REPOSITORY_REFRESH, { repoId }),
        );
        return deserialize(IndexResultModel, response.data);
      },
      onSuccess: handleIndexSuccess,
    });

  const deleteRepository = () =>
    useMutation({
      mutationFn: async (repoId: string) => {
        await axiosInstance.delete(
          generatePath(API_ROUTES.DELETE_REPOSITORY, { repoId }),
        );
      },
      onSuccess: async (_data, id) => {
        await queryClient.cancelQueries({ queryKey: QueryKey.REPOSITORY(id) });
        queryClient.removeQueries({ queryKey: QueryKey.REPOSITORY(id) });
        queryClient.removeQueries({ queryKey: QueryKey.CHUNKS(id) });
        const update = (old: RepositoryList | undefined) => ({
          repositories: (old?.repositories ?? []).filter((repo) => repo.id !== id),
        });
        queryClient.setQueryData<RepositoryList>(QueryKey.REPOSITORIES, update);
        await invalidateRepositories();
      },
    });

  const cancelJob = () =>
    useMutation({
      mutationFn: async ({ jobId }: CancelInput) => {
        await axiosInstance.post(
          generatePath(API_ROUTES.POST_CANCEL_JOB, { jobId }),
        );
      },
      onSuccess: async (_data, input) => {
        await queryClient.cancelQueries({ queryKey: QueryKey.JOBS(input.repoId) });
        const update = (old: JobsResponse | undefined) => ({
          jobs: (old?.jobs ?? []).map((job) =>
            job.id === input.jobId
              ? { ...job, status: JobStatus.CANCELLED }
              : job,
          ),
        });
        queryClient.setQueryData<JobsResponse>(QueryKey.JOBS(input.repoId), update);
        await invalidateRepositories();
      },
    });

  const askAboutRepository = () =>
    useMutation({
      mutationFn: async ({ repoId, ...input }: QuestionInput) => {
        const body = serialize(QuestionBodyModel, input);
        const response = await axiosInstance.post(
          generatePath(API_ROUTES.POST_REPOSITORY_QUESTIONS, { repoId }),
          body,
        );
        return deserialize(AnswerModel, response.data);
      },
    });

  return {
    getReposList,
    getCapacity,
    getJobs,
    getChunkSummary,
    addRepository,
    reindexRepository,
    deleteRepository,
    cancelJob,
    askAboutRepository,
  };
};
