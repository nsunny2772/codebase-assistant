import { Link } from "react-router-dom";

import { commonStrings } from "@src/constants/common";
import { RoutePath } from "@src/routes/routePaths";

import styles from "./workspaceNavigation.module.scss";

export type WorkspaceSection = "dashboard" | "repositories" | "explore";

interface Props {
  current: WorkspaceSection;
  onNavigate: () => void;
}

export const WorkspaceNavigation = ({ current, onNavigate }: Props) => (
  <nav className={styles.navigation}>
    <Link
      to={RoutePath.HOME}
      onClick={onNavigate}
      aria-current={current === "dashboard" ? "page" : undefined}
    >
      {commonStrings.NAVIGATION.DASHBOARD}
    </Link>
    <Link
      to={RoutePath.REPOSITORIES}
      onClick={onNavigate}
      aria-current={current === "repositories" ? "page" : undefined}
    >
      {commonStrings.NAVIGATION.MY_REPOSITORIES}
    </Link>
    <Link
      to={RoutePath.EXPLORE}
      onClick={onNavigate}
      aria-current={current === "explore" ? "page" : undefined}
    >
      {commonStrings.NAVIGATION.EXPLORE}
    </Link>
  </nav>
);

export default WorkspaceNavigation;
