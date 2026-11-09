import clsx from "clsx";
import { useState, type ChangeEvent } from "react";

import type { Repository } from "@src/shared/types/repository";
import { Button } from "@src/shared/components/Button";
import { ConditionalRender } from "@src/shared/components/ConditionalRender";
import { repositoryStrings } from "@src/constants/repository";

import styles from "./repositoryList.module.scss";

interface Props {
  repositories: Repository[];
  selectedId?: string;
  disabled: boolean;
  isLoading: boolean;
  onSelect: (id: string) => void;
}
const RepositoryItem = ({
  repository,
  selectedId,
  disabled,
  onSelect,
}: { repository: Repository } & Pick<
  Props,
  "selectedId" | "disabled" | "onSelect"
>) => {
  const select = () => onSelect(repository.id);
  const ready = Boolean(repository.activeSnapshot);
  return (
    <li>
      <Button
        onClick={select}
        disabled={disabled}
        aria-pressed={selectedId === repository.id}
        className={clsx(
          styles.item,
          selectedId === repository.id && styles.selected,
        )}
      >
        <span className={styles.icon} aria-hidden="true">
          {ready ? "⌘" : "◷"}
        </span>
        <span className={styles.identity}>
          <span className={styles.name}>{repository.name}</span>
          <span className={styles.owner}>{repository.owner}</span>
        </span>
        <span
          className={clsx(styles.status, ready && styles.ready)}
        />
      </Button>
    </li>
  );
};
export const RepositoryList = ({
  repositories,
  selectedId,
  disabled,
  isLoading,
  onSelect,
}: Props) => {
  const [search, setSearch] = useState("");
  const changeSearch = (event: ChangeEvent<HTMLInputElement>) =>
    setSearch(event.target.value);
  const matchesSearch = (repo: Repository) =>
    `${repo.owner}/${repo.name}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  const ready = (repo: Repository) => Boolean(repo.activeSnapshot);
  const pending = (repo: Repository) => !repo.activeSnapshot;
  const filtered = repositories.filter(matchesSearch);
  const indexed = filtered.filter(ready);
  const unfinished = filtered.filter(pending);
  const renderRepository = (repository: Repository) => (
    <RepositoryItem
      key={repository.id}
      repository={repository}
      selectedId={selectedId}
      disabled={disabled}
      onSelect={onSelect}
    />
  );
  return (
    <nav className={styles.library}>
      <label className={styles.searchLabel} htmlFor={repositoryStrings.SEARCH_INPUT_ID}>
        {repositoryStrings.SEARCH_LABEL}
      </label>
      <input
        id={repositoryStrings.SEARCH_INPUT_ID}
        type="search"
        className={styles.search}
        placeholder={repositoryStrings.SEARCH_PLACEHOLDER}
        value={search}
        onChange={changeSearch}
      />
      <ConditionalRender
        visible={Boolean(filtered.length)}
        isLoading={isLoading}
        NoData={
          <p className={styles.empty}>
            {search
              ? repositoryStrings.NO_MATCHING
              : repositoryStrings.EMPTY_LIBRARY}
          </p>
        }
      >
      <div className={styles.scroll}>
        <h3 className={styles.heading}>
          {repositoryStrings.INDEXED_HEADING} <span>{indexed.length}</span>
        </h3>
        <ul className={styles.list}>{indexed.map(renderRepository)}</ul>
        {unfinished.length > 0 && (
          <>
            <h3 className={styles.heading}>
              {repositoryStrings.NOT_READY_HEADING} <span>{unfinished.length}</span>
            </h3>
            <ul className={styles.list}>{unfinished.map(renderRepository)}</ul>
          </>
        )}
      </div>
      </ConditionalRender>
    </nav>
  );
};
