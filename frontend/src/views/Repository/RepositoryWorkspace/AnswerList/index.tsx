import { Empty, List } from "antd";

import type { AnswerMessage } from "@src/shared/types/ui";
import { answerStrings } from "@src/constants/answer";
import { ConditionalRender } from "@src/shared/components/ConditionalRender";
import { renderAnswer } from "@src/views/Repository/RepositoryWorkspace/AnswerList/atoms/AnswerItem";

import styles from "./answerList.module.scss";

export const AnswerList = ({
  messages = [],
  ready,
}: {
  messages?: AnswerMessage[];
  ready: boolean;
}) => (
  <ConditionalRender
    visible={Boolean(messages.length)}
    NoData={
      <Empty
        className={styles.container}
        description={
          ready
            ? answerStrings.EMPTY_READY
            : answerStrings.EMPTY_UNREADY
        }
      />
    }
  >
    <List
      className={styles.container}
      dataSource={messages}
      renderItem={renderAnswer}
    />
  </ConditionalRender>
);
