import clsx from "clsx";
import type { ReactNode } from "react";
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";

import styles from "./form.module.scss";

interface FormProps<T extends FieldValues> {
  children: ReactNode;
  defaultValues?: DefaultValues<T>;
  methods?: UseFormReturn<T>;
  onSubmit: SubmitHandler<T>;
  className?: string;
}
export const Form = <T extends FieldValues = FieldValues>({
  children,
  defaultValues,
  methods,
  onSubmit,
  className,
}: FormProps<T>) => {
  const internal = useForm<T>({ defaultValues });
  const form = methods ?? internal;
  const handleSubmit = form.handleSubmit(onSubmit);
  return (
    <FormProvider {...form}>
      <form
        className={clsx(styles.form, className)}
        noValidate
        onSubmit={handleSubmit}
      >
        {children}
      </form>
    </FormProvider>
  );
};
