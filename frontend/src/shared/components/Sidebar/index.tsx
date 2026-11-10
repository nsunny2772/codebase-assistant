import { Button } from "@src/shared/components/Button";
import { commonStrings } from "@src/constants/common";

import styles from "./sidebar.module.scss";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  heading?: string;
};

export const Sidebar = ({
  open,
  onClose,
  children,
  heading = commonStrings.NAVIGATION.WORKSPACE,
}: Props) => (
  <>
    <aside
      className={styles.sidebar}
      data-open={open}
    >
      <div className={styles.heading}>
        <span className={styles.eyebrow}>{heading}</span>
        <Button
          onClick={onClose}
          className={styles.closeButton}
        >
          {commonStrings.NAVIGATION.CLOSE}
        </Button>
      </div>
      {children}
    </aside>
    {open && (
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
      />
    )}
  </>
);

export { WorkspaceNavigation } from "./WorkspaceNavigation";
