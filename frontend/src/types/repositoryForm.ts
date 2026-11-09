import type { Repository } from "@src/shared/types/repository";

export interface RepositoryFormValues {
  url: string;
}

export interface RepositoryFormProps {
  duplicate?: Repository;
  checking: boolean;
  busy: boolean;
  asking: boolean;
  indexing: boolean;
  onSubmit: (values: RepositoryFormValues) => Promise<void>;
  onOpenDuplicate: () => void;
  onReindexDuplicate: () => void;
}
