import { Typography } from "antd";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import { repositoryStrings } from "@src/constants/repository";
import { HtmlType } from "@src/enums/HtmlType";
import { Button } from "@src/shared/components/Button";
import { Form } from "@src/shared/components/Form";
import { TextAreaInput } from "@src/shared/components/Input";
import type {
  RepositoryQuestionFormProps,
  RepositoryQuestionValues,
} from "@src/types/repositoryWorkspace";
import { questionValidationSchema } from "@src/shared/validation/question.validation";

import styles from "./repositoryQuestionForm.module.scss";

const { Text } = Typography;

export const RepositoryQuestionForm = ({
  repositoryId,
  ready,
  asking,
  onSubmit,
}: RepositoryQuestionFormProps) => {
  const methods = useForm<RepositoryQuestionValues>({
    defaultValues: { question: "" },
    resolver: yupResolver(questionValidationSchema),
  });
  const { reset } = methods;
  const question = useWatch({ control: methods.control, name: "question" });

  useEffect(() => {
    reset();
  }, [repositoryId, reset]);

  const handleSubmit = async (values: RepositoryQuestionValues) => {
    const submitted = await onSubmit(values);
    if (submitted) reset();
  };

  return (
    <div className={styles.composer}>
      <Form
        methods={methods}
        onSubmit={handleSubmit}
      >
        <TextAreaInput
          name="question"
          placeholder={repositoryStrings.QUESTION_PLACEHOLDER}
          maxLength={8000}
          autoSize={{ minRows: 3, maxRows: 8 }}
          disabled={asking || !ready}
        />
        <Button
          htmlType={HtmlType.SUBMIT}
          className={styles.submit}
          type="primary"
          loading={asking}
          disabled={!question.trim() || !ready}
        >
          {repositoryStrings.ASK}
        </Button>
      </Form>
      <Text className={styles.hint} type="secondary">
        {repositoryStrings.QUESTION_HINT}
      </Text>
    </div>
  );
};
