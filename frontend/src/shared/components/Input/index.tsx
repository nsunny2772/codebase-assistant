import type { ChangeEvent } from "react";
import { Input as AntInput, type InputProps } from "antd";
import type { PasswordProps, TextAreaProps } from "antd/es/input";
import {
  useController,
  useFormContext,
  type RegisterOptions,
} from "react-hook-form";

import { FieldError } from "@src/shared/components/FieldError";
import { commonStrings } from "@src/constants/common";

import styles from "./input.module.scss";

type Binding = {
  name: string;
  rules?: RegisterOptions;
  onValueChange?: (value: string) => void;
};
const useField = (name: string, rules?: RegisterOptions) => {
  const form = useFormContext();
  if (!form) throw new Error(commonStrings.ERRORS.INPUT_OUTSIDE_FORM);
  return useController({ name, control: form.control, rules });
};
export const Input = ({
  name,
  rules,
  onValueChange,
  ...props
}: Omit<InputProps, "name" | "value" | "defaultValue" | "onChange"> &
  Binding) => {
  const { field, fieldState } = useField(name, rules);
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target?.value ?? "";
    field.onChange(value);
    onValueChange?.(value);
  };
  return (
    <div className={styles.field}>
      <AntInput
        {...props}
        {...field}
        value={field.value ?? ""}
        aria-invalid={fieldState.invalid}
        status={fieldState.invalid ? "error" : props.status}
        aria-describedby={fieldState.error ? `${name}-error` : undefined}
        onChange={handleChange}
      />
      <FieldError name={name} message={fieldState.error?.message} />
    </div>
  );
};
export const PasswordInput = ({
  name,
  rules,
  onValueChange,
  ...props
}: Omit<PasswordProps, "name" | "value" | "defaultValue" | "onChange"> &
  Binding) => {
  const { field, fieldState } = useField(name, rules);
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target?.value ?? "";
    field.onChange(value);
    onValueChange?.(value);
  };
  return (
    <div className={styles.field}>
      <AntInput.Password
        {...props}
        {...field}
        value={field.value ?? ""}
        aria-invalid={fieldState.invalid}
        status={fieldState.invalid ? "error" : props.status}
        aria-describedby={fieldState.error ? `${name}-error` : undefined}
        onChange={handleChange}
      />
      <FieldError name={name} message={fieldState.error?.message} />
    </div>
  );
};
export const TextAreaInput = ({
  name,
  rules,
  onValueChange,
  ...props
}: Omit<TextAreaProps, "name" | "value" | "defaultValue" | "onChange"> &
  Binding) => {
  const { field, fieldState } = useField(name, rules);
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target?.value ?? "";
    field.onChange(value);
    onValueChange?.(value);
  };
  return (
    <div className={styles.field}>
      <AntInput.TextArea
        {...props}
        {...field}
        value={field.value ?? ""}
        aria-invalid={fieldState.invalid}
        status={fieldState.invalid ? "error" : props.status}
        aria-describedby={fieldState.error ? `${name}-error` : undefined}
        onChange={handleChange}
      />
      <FieldError name={name} message={fieldState.error?.message} />
    </div>
  );
};
