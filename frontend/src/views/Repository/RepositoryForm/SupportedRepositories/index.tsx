import { Space, Tag, Typography } from "antd";

import { examples } from "@src/constants/repositories";
import { repositoryExampleStrings } from "@src/constants/repository";
import { Colors } from "@src/enums/Colors";
import type {
  SupportedRepository,
  SupportedRepositoriesProps,
} from "@src/types/supportedRepository";
import { ExampleCard } from "@src/views/Repository/RepositoryForm/ExampleCard";

import styles from "./supportedRepositories.module.scss";

const { Title, Paragraph, Text } = Typography;

export const SupportedRepositories = ({ disabled, onChoose }: SupportedRepositoriesProps) => {
  const renderExample = (example: SupportedRepository) => (
    <ExampleCard
      key={example.url}
      example={example}
      disabled={disabled}
      onChoose={onChoose}
    />
  );
  return (
    <section
      className={styles.supportedStacks}
    >
      <Title level={4}>
        {repositoryExampleStrings.BUILT_FOR}
      </Title>
      <Space wrap>
        <Tag color={Colors.BLUE}>{repositoryExampleStrings.MERN}</Tag>
        <Tag color={Colors.GREEN}>{repositoryExampleStrings.PYTHON}</Tag>
      </Space>
      <Paragraph>
        {repositoryExampleStrings.DESCRIPTION}
      </Paragraph>
      <Paragraph type="secondary">
        {repositoryExampleStrings.LIMITATIONS}
      </Paragraph>
      <Title level={5}>{repositoryExampleStrings.TITLE}</Title>
      <ul className={styles.examples}>{examples.map(renderExample)}</ul>
      <Text type="secondary">
        {repositoryExampleStrings.INSTRUCTION}
      </Text>
    </section>
  );
};
