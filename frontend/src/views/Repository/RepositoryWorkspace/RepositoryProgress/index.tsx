import { Alert, Space, Spin, Tag } from "antd";

import { AlertType } from "@src/enums/AlertType";
import { Colors } from "@src/enums/Colors";
import { Size } from "@src/enums/Size";
import type { Job } from "@src/models/job.model";
import { JobStatus } from "@src/enums/JobStatus";
import { TERMINAL_JOB_STATUSES } from "@src/constants/config";
import { Button } from "@src/shared/components/Button";
import { indexingStrings } from "@src/constants/indexing";
import { renderWarning } from "@src/views/Repository/RepositoryWorkspace/RepositoryProgress/atoms/WarningItem";

import styles from "./repositoryProgress.module.scss";

export const RepositoryProgress = ({
  job,
  cancelling,
  onCancel,
}: {
  job: Job;
  cancelling: boolean;
  onCancel: () => void;
}) => {
  const status = job.status;
  const working = !TERMINAL_JOB_STATUSES.includes(status);
  const warnings = job.warnings;
  const color =
    status === JobStatus.READY
      ? Colors.GREEN
      : status === JobStatus.FAILED
        ? Colors.RED
        : Colors.BLUE;
  return (
    <section className={styles.progress} aria-live="polite">
      <Space>
        <Tag color={color}>{status}</Tag>
        {working && <Spin size={Size.SMALL} />}
        <span>
          {status === JobStatus.READY && job.chunks === 0
            ? indexingStrings.READY_NO_CHANGES
            : indexingStrings.PROGRESS(
              job.files,
              job.completedChunks,
              job.chunks,
            )}
        </span>
        {working && (
          <Button size={Size.SMALL} loading={cancelling} onClick={onCancel}>
            {indexingStrings.CANCEL}
          </Button>
        )}
      </Space>
      {job.error && (
        <Alert
          type={AlertType.ERROR}
          message={indexingStrings.STOPPED(job.error)}
        />
      )}
      {warnings.length > 0 && (
        <details className={styles.details}>
          <summary>{indexingStrings.WARNINGS(warnings.length)}</summary>
          <ul>{warnings.map(renderWarning)}</ul>
        </details>
      )}
    </section>
  );
};
