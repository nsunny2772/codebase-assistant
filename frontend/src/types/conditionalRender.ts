import type { ReactNode } from "react";

export interface ConditionalRenderProps {
  visible?: boolean;
  isLoading?: boolean;
  NoData?: ReactNode;
  children: ReactNode;
}
