import { Typography } from "antd";

import styles from "./fieldError.module.scss";

const { Text } = Typography;

interface FieldErrorProps {
  name: string;
  message?: string;
}
export const FieldError = ({ name, message }: FieldErrorProps) =>
  message ? (
    <Text
      className={styles.error}
      type="danger"
      role="alert"
      id={`${name}-error`}
    >
      {message}
    </Text>
  ) : null;
