import { Tag, Typography } from "antd";

import { repositoryExampleStrings } from "@src/constants/repository";
import { Size } from "@src/enums/Size";
import { Button } from "@src/shared/components/Button";
import type { SupportedRepositoryCardProps } from "@src/types/supportedRepository";

import styles from "./exampleCard.module.scss";

const { Text } = Typography;

export const ExampleCard = ({
  example,
  disabled,
  onChoose,
}: SupportedRepositoryCardProps) => {
  const handleChoose = () => onChoose(example.url);

  return (
    <li>
      <div>
        <Tag>{example.profile}</Tag>
        <a href={example.url} target="_blank" rel="noreferrer">
          {example.name}
        </a>
      </div>
      <Text className={styles.description} type="secondary">
        {example.description}
      </Text>
      <Button size={Size.SMALL} disabled={disabled} onClick={handleChoose}>
        {repositoryExampleStrings.USE(example.name)}
      </Button>
    </li>
  );
};
