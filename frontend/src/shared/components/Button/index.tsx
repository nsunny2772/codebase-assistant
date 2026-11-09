import clsx from "clsx";
import { Button as AntButton, type ButtonProps } from "antd";

import { HtmlType } from "@src/enums/HtmlType";
import { Size } from "@src/enums/Size";

import styles from "./button.module.scss";

export const Button = ({
  htmlType = HtmlType.BUTTON,
  size = Size.MIDDLE,
  className,
  loading,
  ...props
}: ButtonProps) => {
  return (
    <AntButton
      {...props}
      htmlType={htmlType}
      size={size}
      loading={loading}
      aria-busy={Boolean(loading)}
      className={clsx(styles.button, className)}
    />
  );
};
