export interface SupportedRepository {
  name: string;
  profile: string;
  url: string;
  description: string;
}

export interface SupportedRepositoriesProps {
  disabled: boolean;
  onChoose: (url: string) => void;
}

export interface SupportedRepositoryCardProps extends SupportedRepositoriesProps {
  example: SupportedRepository;
}
