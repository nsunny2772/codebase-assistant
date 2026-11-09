import clsx from "clsx";
import { Select, type SelectProps } from "antd";
import {
  useController,
  useFormContext,
  type RegisterOptions,
} from "react-hook-form";

import { FieldError } from "@src/shared/components/FieldError";
import { commonStrings } from "@src/constants/common";

import styles from "./dropdown.module.scss";

export interface DropdownProps extends Omit<SelectProps<string>, "name"> {
  name?: string;
  rules?: RegisterOptions;
}
const FormDropdown = ({
  name,
  rules,
  ...props
}: DropdownProps & {
  name: string;
}) => {
  const form = useFormContext();
  if (!form) throw new Error(commonStrings.ERRORS.DROPDOWN_OUTSIDE_FORM);
  const { field, fieldState } = useController({
    name,
    control: form.control,
    rules,
  });
  const handleChange: NonNullable<SelectProps<string>["onChange"]> = (
    value,
    option,
  ) => {
    field.onChange(value);
    props.onChange?.(value, option);
  };
  return (
    <div className={styles.field}>
      <Select
        {...props}
        {...field}
        className={clsx(styles.dropdown, props.className)}
        aria-invalid={fieldState.invalid}
        aria-describedby={fieldState.error ? `${name}-error` : undefined}
        status={fieldState.invalid ? "error" : props.status}
        onChange={handleChange}
      />
      <FieldError name={name} message={fieldState.error?.message} />
    </div>
  );
};
export const Dropdown = (props: DropdownProps) => {
  return props.name ? (
    <FormDropdown {...props} name={props.name} />
  ) : (
    <Select {...props} className={clsx(styles.dropdown, props.className)} />
  );
};
