import { Modal, type ModalProps } from "antd";

import { repositoryStrings } from "@src/constants/repository";
import type { RepositoryDialogsProps } from "@src/types/repositoryWorkspace";

export const RepositoryDialogs = ({
  dialog,
  deletePending,
  reindexPending,
  onDelete,
  onDismissDelete,
  onReindex,
  onDismissReindex,
}: RepositoryDialogsProps) => {
  const deleteRepository = dialog?.type === "delete" ? dialog.repository : undefined;
  const reindexRepository = dialog?.type === "reindex" ? dialog.repository : undefined;
  const deleteModalProps: ModalProps | undefined = deleteRepository && {
    open: true,
    title: repositoryStrings.DELETE_TITLE(
      `${deleteRepository.owner}/${deleteRepository.name}`,
    ),
    okText: repositoryStrings.DELETE_DATA,
    cancelText: repositoryStrings.KEEP_REPOSITORY,
    onOk: onDelete,
    onCancel: onDismissDelete,
    confirmLoading: deletePending,
    okButtonProps: { danger: true },
    cancelButtonProps: { disabled: deletePending },
    closable: !deletePending,
    maskClosable: false,
  };
  const reindexModalProps: ModalProps | undefined = reindexRepository && {
    open: true,
    title: repositoryStrings.REINDEX_TITLE(
      `${reindexRepository.owner}/${reindexRepository.name}`,
    ),
    okText: repositoryStrings.REINDEX,
    cancelText: repositoryStrings.KEEP_INDEX,
    onOk: onReindex,
    onCancel: onDismissReindex,
    confirmLoading: reindexPending,
    cancelButtonProps: { disabled: reindexPending },
    closable: !reindexPending,
    maskClosable: false,
  };

  return (
    <>
      {deleteModalProps && (
        <Modal {...deleteModalProps}>
          {repositoryStrings.DELETE_DESCRIPTION}
        </Modal>
      )}
      {reindexModalProps && (
        <Modal {...reindexModalProps}>
          {repositoryStrings.REINDEX_DESCRIPTION}
        </Modal>
      )}
    </>
  );
};
