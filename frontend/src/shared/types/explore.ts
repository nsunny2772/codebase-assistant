export type GitHubRepositorySort = "stars" | "updated";

export type GitHubLanguage =
  | "JavaScript"
  | "TypeScript"
  | "Python"
  | "Go"
  | "Java"
  | "Rust"
  | "C#";

export type CuratedRepositoryCategory =
  | "MERN"
  | "RAG"
  | "AGENTS"
  | "PYTHON"
  | "REACT_NODE";

export interface CuratedRepository {
  fullName: string;
  description: string;
  category: CuratedRepositoryCategory;
  language: string;
}

export interface ExploreSearchValues {
  query: string;
  language?: GitHubLanguage;
  sort: GitHubRepositorySort;
  page: number;
}

export interface ExploreRepositoryCardProps {
  repository: {
    fullName: string;
    url: string;
    description?: string | null;
    language?: string | null;
    stars?: number;
  };
  category?: string;
  indexed?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onIndex: (url: string) => void;
}
