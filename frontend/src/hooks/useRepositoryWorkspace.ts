import { generatePath, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { repositoryStrings } from "@src/constants/repository";
import { RoutePath } from "@src/routes/routePaths";
import { normalizeRepositoryUrl } from "@src/shared/utils/repositoryUrl";
import type { Repository } from "@src/shared/types/repository";
import type { AnswerMessage } from "@src/shared/types/ui";
import type {
  RepositoryQuestionValues,
  WorkspaceAction,
  WorkspaceState,
} from "@src/types/repositoryWorkspace";
import { useMountedRef } from "@src/hooks/useMountedRef";
import { errorMessage } from "@src/shared/utils/errors";
import { TERMINAL_JOB_STATUSES } from "@src/constants/config";
import { RepositoryService } from "@src/services/repository.service";
import { useJobCompletion } from "@src/hooks/useJobCompletion";
import { showToast } from "@src/shared/components/Toast";

const initialWorkspaceState: WorkspaceState = {
  sidebarOpen: false,
  messages: [],
};

const workspaceReducer = (
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState => {
  switch (action.type) {
    case "set-sidebar":
      return { ...state, sidebarOpen: action.open };
    case "set-duplicate":
      return { ...state, duplicate: action.repository };
    case "set-dialog":
      return { ...state, dialog: action.dialog };
    case "append-message":
      return { ...state, messages: [...state.messages, action.message] };
    case "reset-messages":
      return { ...state, messages: [] };
    default:
      return state;
  }
};

export const useRepositoryWorkspace = () => {
  const client = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { repoId: selectedId } = useParams();
  const showingRepos =
    location.pathname === RoutePath.REPOSITORIES || Boolean(selectedId);
  const [workspaceState, dispatch] = useReducer(
    workspaceReducer,
    initialWorkspaceState,
  );
  const { sidebarOpen, duplicate, dialog, messages } = workspaceState;
  const deleteRepo = dialog?.type === "delete" ? dialog.repository : undefined;
  const reindexRepo = dialog?.type === "reindex" ? dialog.repository : undefined;
  const conversationEnd = useRef<HTMLDivElement>(null);
  const conversation = useRef(crypto.randomUUID());
  const mounted = useMountedRef();
  const {
    getReposList,
    getCapacity,
    getJobs,
    getChunkSummary,
    addRepository,
    reindexRepository,
    deleteRepository,
    cancelJob,
    askAboutRepository,
  } = RepositoryService();
  const repositoryQuery = getReposList();
  const capacityQuery = getCapacity(!showingRepos);

  const { data: repositoryData } = repositoryQuery;
  const { data: capacity } = capacityQuery;

  const repositories = repositoryData?.repositories ?? [];
  const selected = selectedId
    ? repositories.find((repo) => repo.id === selectedId)
    : undefined;
  const jobsQuery = getJobs(selected?.id);
  const chunkSummaryQuery = getChunkSummary(selected?.id);
  const { data: jobsData } = jobsQuery;
  const job = jobsData?.jobs[0];
  useJobCompletion(job, true, client);

  const mutations = {
    submit: addRepository(),
    refresh: reindexRepository(),
    remove: deleteRepository(),
    cancel: cancelJob(),
    ask: askAboutRepository(),
  };
  const busy =
    repositoryQuery.isFetching ||
    mutations.submit.isPending ||
    mutations.refresh.isPending ||
    mutations.remove.isPending ||
    mutations.cancel.isPending;
  const asking = mutations.ask.isPending;
  const queryError = repositoryQuery.error ?? capacityQuery.error ?? jobsQuery.error;


  const report = (failure: unknown) => {
    if (mounted.current)
      showToast({ type: "error", message: errorMessage(failure) });
  };
  const submit = async ({ url }: { url: string }) => {
    dispatch({ type: "set-duplicate" });
    try {
      const refreshed = await repositoryQuery.refetch();
      if (refreshed.isError) throw refreshed.error;
      if (!mounted.current) return;
      const existing = refreshed.data?.repositories.find(
        (repo) => normalizeRepositoryUrl(repo.url) === normalizeRepositoryUrl(url),
      );
      if (existing) {
        dispatch({ type: "set-duplicate", repository: existing });
        return;
      }
      const data = await mutations.submit.mutateAsync(url.trim());
      if (!mounted.current) return;
      navigate(
        data.repo.id
          ? generatePath(RoutePath.REPOSITORY, { repoId: data.repo.id })
          : RoutePath.REPOSITORIES,
      );
      showToast({ type: "success", message: repositoryStrings.INDEXED_SUCCESS });
    } catch (failure) {
      report(failure);
    }
  };
  const ask = async ({ question: prompt }: RepositoryQuestionValues) => {
    if (!selected?.activeSnapshot) return false;
    try {
      const result = await mutations.ask.mutateAsync({
        repoId: selected.id,
        question: prompt.trim(),
        conversationId: conversation.current,
        snapshotId: selected.activeSnapshot,
      });
      if (mounted.current && selectedId === selected.id) {
        dispatch({
          type: "append-message",
          message: { question: prompt, result } satisfies AnswerMessage,
        });
        return true;
      }
      return false;
    } catch (failure) {
      report(failure);
      return false;
    }
  };
  const cancel = async () => {
    if (!selected || !job) return;
    try {
      await mutations.cancel.mutateAsync({ repoId: selected.id, jobId: job.id });
      if (mounted.current)
        showToast({ type: "success", message: repositoryStrings.CANCELLED_SUCCESS });
    } catch (failure) {
      report(failure);
    }
  };
  const remove = () => {
    if (selected)
      dispatch({ type: "set-dialog", dialog: { type: "delete", repository: selected } });
  };
  const dismissDelete = () => dispatch({ type: "set-dialog" });
  const performDelete = async () => {
    if (!deleteRepo) return;
    try {
      await mutations.remove.mutateAsync(deleteRepo.id);
      if (mounted.current) {
        navigate(RoutePath.REPOSITORIES);
        dispatch({ type: "set-dialog" });
        showToast({ type: "success", message: repositoryStrings.DELETED_SUCCESS });
      }
    } catch (failure) {
      report(failure);
    }
  };
  const choose = (id: string) => {
    navigate(generatePath(RoutePath.REPOSITORY, { repoId: id }));
    dispatch({ type: "set-sidebar", open: false });
  };
  const toggleSidebar = () =>
    dispatch({ type: "set-sidebar", open: !sidebarOpen });
  const closeSidebar = () => dispatch({ type: "set-sidebar", open: false });
  const confirmReindex = (repository: Repository) =>
    dispatch({ type: "set-dialog", dialog: { type: "reindex", repository } });
  const dismissReindex = () => dispatch({ type: "set-dialog" });
  const performReindex = async () => {
    if (!reindexRepo) return;
    try {
      await mutations.refresh.mutateAsync(reindexRepo.id);
      if (mounted.current) {
        choose(reindexRepo.id);
        dispatch({ type: "set-duplicate" });
        dispatch({ type: "set-dialog" });
        showToast({ type: "success", message: repositoryStrings.REINDEXED_SUCCESS });
      }
    } catch (failure) {
      report(failure);
    }
  };
  const handleRefresh = () => {
    if (selected) confirmReindex(selected);
  };
  const openDuplicate = () => {
    if (duplicate) {
      choose(duplicate.id);
      dispatch({ type: "set-duplicate" });
    }
  };
  const reindexDuplicate = () => {
    if (duplicate) confirmReindex(duplicate);
  };
  const handleCancel = () => void cancel();

  useEffect(() => {
    dispatch({ type: "reset-messages" });
    conversation.current = crypto.randomUUID();
  }, [selectedId]);

  useEffect(() => {
    if (messages.length)
      conversationEnd.current?.scrollIntoView?.({
        block: "end",
        behavior: "smooth",
      });
  }, [messages.length]);

  useEffect(() => {
    if (queryError)
      showToast({ type: "error", message: errorMessage(queryError) });
  }, [queryError]);


  return {
    showingRepos,
    sidebarOpen,
    duplicate,
    dialog,
    messages,
    conversationEnd,
    repositoryQuery,
    repositories,
    capacity,
    selectedId,
    selected,
    job,
    fileChunks: chunkSummaryQuery.data?.files ?? [],
    mutations,
    busy,
    asking,
    working: job && !TERMINAL_JOB_STATUSES.includes(job.status),
    submit,
    ask,
    remove,
    performDelete,
    dismissDelete,
    choose,
    toggleSidebar,
    closeSidebar,
    dismissReindex,
    performReindex,
    handleRefresh,
    openDuplicate,
    reindexDuplicate,
    handleCancel,
  };
};
