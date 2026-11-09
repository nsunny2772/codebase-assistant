import { Spin } from "antd";

import type { ConditionalRenderProps } from "@src/types/conditionalRender";

import styles from "./conditionalRender.module.scss";

export const ConditionalRender = ({
  visible = true,
  isLoading = false,
  NoData = null,
  children,
}: ConditionalRenderProps) => {
  if (isLoading) {
    return (
      <div className={styles.loading} aria-busy="true">
        <Spin />
      </div>
    );
  }

  return visible ? <>{children}</> : <>{NoData}</>;
};

export default ConditionalRender;
