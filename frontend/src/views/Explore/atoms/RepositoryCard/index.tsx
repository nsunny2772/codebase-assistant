import { Tag } from "antd";

import { exploreStrings } from "@src/constants/explore";
import { Colors } from "@src/enums/Colors";
import { Size } from "@src/enums/Size";
import { Button } from "@src/shared/components/Button";
import type { ExploreRepositoryCardProps } from "@src/shared/types/explore";

import styles from "./repositoryCard.module.scss";

const formatStars = (stars: number) => new Intl.NumberFormat().format(stars);

export const RepositoryCard = ({
  repository,
  category,
  indexed = false,
  busy = false,
  disabled = false,
  onIndex,
}: ExploreRepositoryCardProps) => {
  const indexRepository = () => onIndex(repository.url);
  return (
    <article className={styles.card}>
      <div className={styles.heading}>
        <div className={styles.identity}>
          {category && <Tag color={Colors.BLUE}>{category}</Tag>}
          <a href={repository.url} target="_blank" rel="noreferrer">
            {repository.fullName}
          </a>
        </div>
        <Button
          size={Size.SMALL}
          type={indexed ? "default" : "primary"}
          loading={busy}
          disabled={disabled || (indexed && busy)}
          onClick={indexRepository}
        >
          {indexed ? exploreStrings.ALREADY_INDEXED : exploreStrings.INDEX}
        </Button>
      </div>
      <p className={styles.description}>
        {repository.description || exploreStrings.NO_DESCRIPTION}
      </p>
      <div className={styles.meta}>
        {repository.language && <span>{repository.language}</span>}
        {repository.stars !== undefined && (
          <span>{exploreStrings.STARS(formatStars(repository.stars))}</span>
        )}
      </div>
    </article>
  );
};

export default RepositoryCard;
