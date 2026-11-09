import { List, Tag, Typography } from "antd";

import type { AnswerModel } from "@src/models/answer.model";
import type { AnswerMessage } from "@src/shared/types/ui";
import { answerStrings } from "@src/constants/answer";
import { commonStrings } from "@src/constants/common";

import styles from "./answerItem.module.scss";

const { Title, Paragraph } = Typography;

type Citation = AnswerModel["citations"][number];

const renderCitation = (citation: Citation, index: number) => {
  const label = answerStrings.CITATION_LABEL(
    citation.path || commonStrings.COMMON.UNKNOWN_FILE,
    citation.startLine,
    citation.endLine,
  );

  return (
    <li key={citation.id || index}>
      {citation.url ? (
        <a href={citation.url} target="_blank" rel="noreferrer">
          {label}
        </a>
      ) : (
        <span>{label}</span>
      )}
    </li>
  );
};

const renderLimitation = (limitation: string, index: number) => (
  <li key={index}>{limitation || answerStrings.SCOPE_UNAVAILABLE}</li>
);

const numberCitation = (text: string, citation: Citation, index: number) =>
  citation.id ? text.replaceAll(`[${citation.id}]`, `[${index + 1}]`) : text;

export const renderAnswer = ({ question, result }: AnswerMessage) => (
  <List.Item>
    <article className={styles.article}>
      <Title level={4}>{question || answerStrings.QUESTION_FALLBACK}</Title>
      {result.abstained && <Tag>{answerStrings.LIMITED_EVIDENCE}</Tag>}
      <Paragraph className={styles.answer}>
        {result.citations.reduce(
          numberCitation,
          result.answer || answerStrings.UNAVAILABLE,
        )}
      </Paragraph>
      <ol>{result.citations.map(renderCitation)}</ol>
      <details className={styles.details}>
        <summary>{answerStrings.SCOPE}</summary>
        <p>
          {answerStrings.COMMIT_LABEL(
            result.commit.slice(0, 12) || commonStrings.COMMON.UNAVAILABLE,
            result.runId || commonStrings.COMMON.UNAVAILABLE,
          )}
        </p>
        <ul>{result.limitations.map(renderLimitation)}</ul>
      </details>
    </article>
  </List.Item>
);
