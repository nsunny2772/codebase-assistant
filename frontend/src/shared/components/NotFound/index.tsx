import { Typography } from "antd";
import { Link } from "react-router-dom";

import { commonStrings } from "@src/constants/common";
import { RoutePath } from "@src/routes/routePaths";

import styles from "./notFound.module.scss";

const { Title, Paragraph } = Typography;

const NotFound = () => (
  <main className={styles.page}>
    <Title>{commonStrings.NAVIGATION.PAGE_NOT_FOUND}</Title>
    <Paragraph>
      {commonStrings.NAVIGATION.REQUESTED_PAGE_UNAVAILABLE}
    </Paragraph>
    <Link to={RoutePath.HOME}>{commonStrings.NAVIGATION.BACK_TO_HOME}</Link>
  </main>
);

export default NotFound;
