import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { QueryKey } from "@src/constants/QueryKey";
import { TERMINAL_JOB_STATUSES } from "@src/constants/config";
import type { Job } from "@src/models/job.model";

export const useJobCompletion = (
  job: Job | undefined,
  enabled: boolean,
  client: QueryClient,
) => {
  const handleCompletion = () => {
    if (!enabled || !job || !TERMINAL_JOB_STATUSES.includes(job.status)) return;
    void client.invalidateQueries({ queryKey: QueryKey.REPOSITORIES });
    void client.invalidateQueries({ queryKey: QueryKey.CAPACITY });
    void client.invalidateQueries({ queryKey: QueryKey.CHUNKS(job.repoId) });
  };
  useEffect(handleCompletion, [enabled, job?.id, job?.status, client]);
};
