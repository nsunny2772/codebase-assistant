export interface Repo {
  id: string;
  url: string;
  owner: string;
  name: string;
  activeSnapshot: string;
  commit: string;
  createdAt: number;
  deletedAt?: number;
}
