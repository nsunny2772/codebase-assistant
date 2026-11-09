import type { AnswerMessage } from "@src/shared/types/ui";
import type { Repository } from "@src/shared/types/repository";
import type { RepositoryFileChunk } from "@src/shared/types/repository";

export interface RepositoryQuestionValues {
  question: string;
}

export interface RepositoryQuestionFormProps {
  repositoryId: string;
  ready: boolean;
  asking: boolean;
  onSubmit: (values: RepositoryQuestionValues) => Promise<boolean>;
}

export interface IndexedFilesProps {
  files: RepositoryFileChunk[];
}

export interface RepositoryDialogsProps {
  dialog?: WorkspaceDialog;
  deletePending: boolean;
  reindexPending: boolean;
  onDelete: () => void;
  onDismissDelete: () => void;
  onReindex: () => void;
  onDismissReindex: () => void;
}

export interface DeleteWorkspaceDialog {
  type: "delete";
  repository: Repository;
}

export interface ReindexWorkspaceDialog {
  type: "reindex";
  repository: Repository;
}

export type WorkspaceDialog = DeleteWorkspaceDialog | ReindexWorkspaceDialog;

export interface WorkspaceState {
  sidebarOpen: boolean;
  duplicate?: Repository;
  dialog?: WorkspaceDialog;
  messages: AnswerMessage[];
}

export interface SetSidebarAction {
  type: "set-sidebar";
  open: boolean;
}

export interface SetDuplicateAction {
  type: "set-duplicate";
  repository?: Repository;
}

export interface SetDialogAction {
  type: "set-dialog";
  dialog?: WorkspaceDialog;
}

export interface AppendMessageAction {
  type: "append-message";
  message: AnswerMessage;
}

export interface ResetMessagesAction {
  type: "reset-messages";
}

export type WorkspaceAction =
  | SetSidebarAction
  | SetDuplicateAction
  | SetDialogAction
  | AppendMessageAction
  | ResetMessagesAction;
