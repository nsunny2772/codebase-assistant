import { Link } from "react-router-dom";
import { Alert, Empty, Space, Typography } from "antd";

import { commonStrings } from "@src/constants/common";
import { repositoryStrings } from "@src/constants/repository";
import { RoutePath } from "@src/routes/routePaths";
import { AlertType } from "@src/enums/AlertType";
import { isNearLimit } from "@src/shared/utils/capacity";
import { RepositoryList } from "@src/views/Repository/RepositoryList";
import { RepositoryForm } from "@src/views/Repository/RepositoryForm";
import { RepositoryProgress } from "@src/views/Repository/RepositoryWorkspace/RepositoryProgress";
import { IndexedFiles } from "@src/views/Repository/RepositoryWorkspace/IndexedFiles";
import { AnswerList } from "@src/views/Repository/RepositoryWorkspace/AnswerList";
import { RepositoryDialogs } from "@src/views/Repository/RepositoryWorkspace/RepositoryDialogs";
import { Button } from "@src/shared/components/Button";
import { ConditionalRender } from "@src/shared/components/ConditionalRender";
import { Sidebar, WorkspaceNavigation } from "@src/shared/components/Sidebar";
import { RepositoryQuestionForm } from "@src/views/Repository/RepositoryWorkspace/RepositoryQuestionForm";
import { useRepositoryWorkspace } from "@src/hooks/useRepositoryWorkspace";

import styles from "./repositoryWorkspace.module.scss";

const { Title, Paragraph, Text } = Typography;

const RepositoryWorkspace = () => {
  const workspace = useRepositoryWorkspace();
  const {
    showingRepos,
    sidebarOpen,
    duplicate,
    dialog,
    messages,
    conversationEnd,
    repositoryQuery,
    repositories,
    capacity,
    selectedId,
    selected,
    job,
    fileChunks,
    mutations,
    busy,
    asking,
    working,
    submit,
    ask,
    remove,
    performDelete,
    dismissDelete,
    choose,
    toggleSidebar,
    closeSidebar,
    performReindex,
    dismissReindex,
    handleRefresh,
    openDuplicate,
    reindexDuplicate,
    handleCancel,
  } = workspace;

  return (
    <div className={styles.workspace}>
      <RepositoryDialogs
        dialog={dialog}
        deletePending={mutations.remove.isPending}
        reindexPending={mutations.refresh.isPending}
        onDelete={performDelete}
        onDismissDelete={dismissDelete}
        onReindex={performReindex}
        onDismissReindex={dismissReindex}
      />

      <Sidebar open={sidebarOpen} onClose={closeSidebar}>
        <WorkspaceNavigation
          current={showingRepos ? "repositories" : "dashboard"}
          onNavigate={closeSidebar}
        />
      </Sidebar>

      <div className={styles.content}>
        <header className={styles.workspaceHeader}>
          <div className={styles.headerIdentity}>
            <Button
              onClick={toggleSidebar}
              className={styles.mobileOnly}
              aria-expanded={sidebarOpen}
            >
              Menu
            </Button>
            <Title level={2}>
              {selected
                ? `${selected.owner}/${selected.name}`
                : showingRepos
                  ? commonStrings.NAVIGATION.MY_REPOSITORIES
                  : commonStrings.NAVIGATION.DASHBOARD}
            </Title>
          </div>
        </header>

        <main className={styles.main}>
          {!showingRepos &&
            capacity &&
            (isNearLimit(capacity.nodes, capacity.nodeLimit) ||
              isNearLimit(capacity.relationships, capacity.relationshipLimit)) && (
              <Alert
                className={styles.section}
                type={AlertType.WARNING}
                message={repositoryStrings.GRAPH_LIMIT}
              />
            )}

          {!showingRepos && (
            <>
              {capacity && (
                <Paragraph className={styles.section} type="secondary">
                  {repositoryStrings.GRAPH_USAGE(
                    capacity.nodes.toLocaleString(),
                    capacity.nodeLimit.toLocaleString(),
                    capacity.relationships.toLocaleString(),
                    capacity.relationshipLimit.toLocaleString(),
                  )}
                </Paragraph>
              )}

              <RepositoryForm
                duplicate={duplicate}
                checking={repositoryQuery.isFetching || mutations.submit.isPending}
                busy={busy}
                asking={asking}
                indexing={Boolean(working)}
                onSubmit={submit}
                onOpenDuplicate={openDuplicate}
                onReindexDuplicate={reindexDuplicate}
              />
            </>
          )}

          {showingRepos && !selectedId && (
            <div className={styles.repoList}>
              <RepositoryList
                repositories={repositories}
                disabled={asking || busy}
                isLoading={repositoryQuery.isLoading}
                onSelect={choose}
              />
            </div>
          )}

          {selectedId && (
            <ConditionalRender
              visible={Boolean(selected)}
              isLoading={repositoryQuery.isLoading}
              NoData={
                <Empty description={repositoryStrings.REPOSITORY_UNAVAILABLE}>
                  <Link to={RoutePath.REPOSITORIES}>
                    {repositoryStrings.BACK_TO_REPOSITORIES}
                  </Link>
                </Empty>
              }
            >
              {selected && (
                <section className={styles.chat}>
                  <div className={styles.repoHeader}>
                    <Title level={3}>
                      {repositoryStrings.ASK_ABOUT(`${selected.owner}/${selected.name}`)}
                    </Title>
                    <Space wrap>
                      <Button
                        disabled={busy || Boolean(working) || asking}
                        onClick={handleRefresh}
                      >
                        {repositoryStrings.REINDEX}
                      </Button>
                      <Button danger disabled={busy || asking} onClick={remove}>
                        {repositoryStrings.DELETE_DATA}
                      </Button>
                    </Space>
                  </div>
                  <div className={styles.repositoryStatus}>
                    {job && (
                      <RepositoryProgress
                        job={job}
                        cancelling={mutations.cancel.isPending}
                        onCancel={handleCancel}
                      />
                    )}
                    {selected.commit && (
                      <Paragraph className={styles.section}>
                        {repositoryStrings.INDEXED_COMMIT}{" "}
                        <Text code>
                          {selected.commit.slice(0, 12) || commonStrings.COMMON.UNAVAILABLE}
                        </Text>
                      </Paragraph>
                    )}
                    <IndexedFiles files={fileChunks} />
                  </div>
                  <div
                    className={styles.conversation}
                    data-populated={messages.length > 0}
                  >
                    <AnswerList
                      messages={messages}
                      ready={Boolean(selected.activeSnapshot)}
                    />
                    <div ref={conversationEnd} />
                  </div>
                  <RepositoryQuestionForm
                    repositoryId={selected.id}
                    ready={Boolean(selected.activeSnapshot)}
                    asking={asking}
                    onSubmit={ask}
                  />
                </section>
              )}
            </ConditionalRender>
          )}
        </main>
      </div>
    </div>
  );
};

export default RepositoryWorkspace;
