import { Typography } from "antd";

import { commonStrings } from "@src/constants/common";

import styles from "./navbar.module.scss";

const { Title } = Typography;

export const Navbar = () => {
  return (
    <header className={styles.navbar}>
      <Title level={2}>{commonStrings.APP_TITLE}</Title>
    </header>
  );
};
