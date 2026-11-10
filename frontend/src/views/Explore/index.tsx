import { useEffect, useState, type ChangeEvent } from "react";
import { Alert, Empty, Input, Select, Spin, Tag, Typography } from "antd";
import { generatePath, useNavigate } from "react-router-dom";

import { commonStrings } from "@src/constants/common";
import { exploreStrings } from "@src/constants/explore";
import { repositoryStrings } from "@src/constants/repository";
import { Size } from "@src/enums/Size";
import { RepositoryService } from "@src/services/repository.service";
import { ExploreService } from "@src/services/explore.service";
import { ExploreRepositoryModel } from "@src/models/explore.model";
import { RoutePath } from "@src/routes/routePaths";
import { errorMessage } from "@src/shared/utils/errors";
import { normalizeRepositoryUrl } from "@src/shared/utils/repositoryUrl";
import { Button } from "@src/shared/components/Button";
import { Sidebar, WorkspaceNavigation } from "@src/shared/components/Sidebar";
import { showToast } from "@src/shared/components/Toast";
import type {
  CuratedRepository,
  CuratedRepositoryCategory,
  ExploreSearchValues,
  GitHubLanguage,
  GitHubRepositorySort,
} from "@src/shared/types/explore";
import { RepositoryCard } from "@src/views/Explore/atoms/RepositoryCard";

import styles from "./explore.module.scss";

const { Title, Paragraph, Text } = Typography;
const curatedCategories: CuratedRepositoryCategory[] = [
  "MERN",
  "RAG",
  "AGENTS",
  "PYTHON",
  "REACT_NODE",
];
const sortOptions = exploreStrings.SORT_OPTIONS.map((sort) => ({
  value: sort,
  label: sort === "stars" ? exploreStrings.SORT_STARS : exploreStrings.SORT_UPDATED,
}));
const languageOptions = exploreStrings.LANGUAGES.map((language) => ({
  label: language,
  value: language,
}));

interface SearchState {
  text: string;
  language?: GitHubLanguage;
  sort: GitHubRepositorySort;
  page: number;
  sidebarOpen: boolean;
}

interface SettledSearchState {
  text: string;
  language?: GitHubLanguage;
  sort: GitHubRepositorySort;
}

const initialSearchState: SearchState = {
  text: "",
  sort: "stars",
  page: 1,
  sidebarOpen: false,
};
const initialSettledSearch: SettledSearchState = {
  text: "",
  sort: "stars",
};

const Explore = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState(initialSearchState);
  const [settledSearch, setSettledSearch] = useState(initialSettledSearch);
  const [indexingUrl, setIndexingUrl] = useState("");
  const repositoryService = RepositoryService();
  const { data: repositoryData, refetch: refreshRepositories } =
    repositoryService.getReposList();
  const addRepository = repositoryService.addRepository();
  const { searchPublicRepositories } = ExploreService();
  const searchValues: ExploreSearchValues = {
    query: settledSearch.text,
    language: settledSearch.language,
    sort: settledSearch.sort,
    page: search.page,
  };
  const searchQuery = searchPublicRepositories(searchValues);
  const indexedRepositories = repositoryData?.repositories ?? [];
  const pageCount = Math.min(
    Math.ceil((searchQuery.data?.totalCount ?? 0) / 10),
    100,
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSettledSearch({
        text: search.text.trim(),
        language: search.language,
        sort: search.sort,
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [search.text, search.language, search.sort]);

  const updateSearchText = (event: ChangeEvent<HTMLInputElement>) =>
    setSearch((current) => ({ ...current, text: event.target.value, page: 1 }));
  const updateLanguage = (language?: GitHubLanguage) =>
    setSearch((current) => ({ ...current, language, page: 1 }));
  const updateSort = (sort: GitHubRepositorySort) =>
    setSearch((current) => ({ ...current, sort, page: 1 }));
  const openSidebar = () => setSearch((current) => ({ ...current, sidebarOpen: true }));
  const closeSidebar = () => setSearch((current) => ({ ...current, sidebarOpen: false }));
  const previousPage = () =>
    setSearch((current) => ({ ...current, page: Math.max(1, current.page - 1) }));
  const nextPage = () =>
    setSearch((current) => ({ ...current, page: Math.min(pageCount, current.page + 1) }));
  const retrySearch = () => void searchQuery.refetch();

  const indexRepository = async (url: string) => {
    setIndexingUrl(url);
    try {
      const refreshedRepositories = await refreshRepositories();
      if (refreshedRepositories.isError) throw refreshedRepositories.error;
      const normalizedUrl = normalizeRepositoryUrl(url);
      const existing = refreshedRepositories.data?.repositories.find(
        (repository) => normalizeRepositoryUrl(repository.url) === normalizedUrl,
      );
      if (existing) {
        navigate(generatePath(RoutePath.REPOSITORY, { repoId: existing.id }));
        return;
      }
      const result = await addRepository.mutateAsync(url);
      navigate(generatePath(RoutePath.REPOSITORY, { repoId: result.repo.id }));
      showToast({ type: "success", message: repositoryStrings.INDEXED_SUCCESS });
    } catch (failure) {
      showToast({ type: "error", message: errorMessage(failure) });
    } finally {
      setIndexingUrl("");
    }
  };

  const renderCuratedRepository = (repository: CuratedRepository) => {
    const url = `https://github.com/${repository.fullName}`;
    const isIndexed = indexedRepositories.some(
      (item) => normalizeRepositoryUrl(item.url) === normalizeRepositoryUrl(url),
    );
    return (
      <RepositoryCard
        key={repository.fullName}
        repository={{
          fullName: repository.fullName,
          url,
          description: repository.description,
          language: repository.language,
        }}
        category={exploreStrings.CATEGORIES[repository.category]}
        indexed={isIndexed}
        busy={indexingUrl === url}
        disabled={Boolean(indexingUrl)}
        onIndex={indexRepository}
      />
    );
  };

  const renderCategory = (category: CuratedRepositoryCategory) => (
    <section className={styles.category} key={category}>
      <Title level={4}>{exploreStrings.CATEGORIES[category]}</Title>
      <div className={styles.grid}>
        {exploreStrings.CURATED
          .filter((repository) => repository.category === category)
          .map(renderCuratedRepository)}
      </div>
    </section>
  );

  const renderSearchResult = (repository: ExploreRepositoryModel) => {
    const isIndexed = indexedRepositories.some(
      (item) => normalizeRepositoryUrl(item.url) === normalizeRepositoryUrl(repository.url),
    );
    return (
      <RepositoryCard
        key={repository.url}
        repository={repository}
        indexed={isIndexed}
        busy={indexingUrl === repository.url}
        disabled={Boolean(indexingUrl)}
        onIndex={indexRepository}
      />
    );
  };

  const searchResults = () => {
    if (search.text.trim().length < 2) {
      return <Empty description={exploreStrings.SEARCH_HINT} />;
    }
    if (
      settledSearch.text !== search.text.trim() ||
      settledSearch.language !== search.language ||
      settledSearch.sort !== search.sort
    ) {
      return <Spin className={styles.searchLoading} />;
    }
    if (searchQuery.isLoading) return <Spin className={styles.searchLoading} />;
    if (searchQuery.isError) {
      return (
        <Alert
          type="error"
          message={errorMessage(searchQuery.error) || exploreStrings.SEARCH_ERROR}
          action={
            <Button size={Size.SMALL} onClick={retrySearch}>
              {commonStrings.COMMON.RETRY}
            </Button>
          }
        />
      );
    }
    if (!searchQuery.data?.repositories.length) {
      return <Empty description={exploreStrings.NO_RESULTS} />;
    }
    return (
      <>
        <div className={styles.resultMeta}>
          <Text type="secondary">
            {exploreStrings.RESULT_COUNT(searchQuery.data.totalCount)}
          </Text>
          <Text type="secondary">
            {exploreStrings.PAGE(search.page, pageCount)}
          </Text>
        </div>
        <div className={styles.grid}>{searchQuery.data.repositories.map(renderSearchResult)}</div>
        {pageCount > 1 && (
          <div className={styles.pagination}>
            <Button disabled={search.page <= 1} onClick={previousPage}>
              {commonStrings.COMMON.PREVIOUS}
            </Button>
            <Button disabled={search.page >= pageCount} onClick={nextPage}>
              {commonStrings.COMMON.NEXT}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className={styles.layout}>
      <Sidebar open={search.sidebarOpen} onClose={closeSidebar}>
        <WorkspaceNavigation current="explore" onNavigate={closeSidebar} />
      </Sidebar>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <Button className={styles.mobileOnly} onClick={openSidebar}>
            {commonStrings.NAVIGATION.MENU}
          </Button>
          <div>
            <Title level={2}>{exploreStrings.TITLE}</Title>
            <Paragraph>{exploreStrings.DESCRIPTION}</Paragraph>
          </div>
        </header>
        <main className={styles.main}>
          <section className={styles.searchSection}>
            <div className={styles.sectionHeading}>
              <Title level={3}>{exploreStrings.SEARCH_TITLE}</Title>
              <Paragraph type="secondary">{exploreStrings.SEARCH_DESCRIPTION}</Paragraph>
            </div>
            <div className={styles.filters}>
              <div className={styles.filterField}>
                <Text type="secondary">{exploreStrings.SEARCH_LABEL}</Text>
                <Input
                  type="search"
                  value={search.text}
                  onChange={updateSearchText}
                  placeholder={exploreStrings.SEARCH_PLACEHOLDER}
                  className={styles.queryInput}
                />
              </div>
              <div className={styles.filterField}>
                <Text type="secondary">{exploreStrings.LANGUAGE_LABEL}</Text>
                <Select
                  allowClear
                  placeholder={exploreStrings.ANY_LANGUAGE}
                  value={search.language}
                  onChange={updateLanguage}
                  options={languageOptions}
                />
              </div>
              <div className={styles.filterField}>
                <Text type="secondary">{exploreStrings.SORT_LABEL}</Text>
                <Select
                  value={search.sort}
                  onChange={updateSort}
                  options={sortOptions}
                />
              </div>
            </div>
            <div className={styles.results}>{searchResults()}</div>
          </section>

          <section className={styles.featured}>
            <div className={styles.sectionHeading}>
              <Title level={3}>{exploreStrings.FEATURED_TITLE}</Title>
              <Paragraph type="secondary">{exploreStrings.FEATURED_DESCRIPTION}</Paragraph>
              <div className={styles.categoryLegend}>
                <Tag>{exploreStrings.CATEGORIES.MERN}</Tag>
                <Tag>{exploreStrings.CATEGORIES.RAG}</Tag>
                <Tag>{exploreStrings.CATEGORIES.AGENTS}</Tag>
                <Tag>{exploreStrings.CATEGORIES.PYTHON}</Tag>
                <Tag>{exploreStrings.CATEGORIES.REACT_NODE}</Tag>
              </div>
            </div>
            {curatedCategories.map(renderCategory)}
          </section>
        </main>
      </div>
    </div>
  );
};

export default Explore;
