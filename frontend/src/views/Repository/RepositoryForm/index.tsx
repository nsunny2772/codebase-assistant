import { Typography } from "antd";
import { useForm, useWatch } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import { Button } from "@src/shared/components/Button";
import { Form } from "@src/shared/components/Form";
import { Input } from "@src/shared/components/Input";
import { repositoryStrings } from "@src/constants/repository";
import { HtmlType } from "@src/enums/HtmlType";
import type {
  RepositoryFormProps,
  RepositoryFormValues,
} from "@src/types/repositoryForm";
import { SupportedRepositories } from "@src/views/Repository/RepositoryForm/SupportedRepositories";
import { repositoryValidationSchema } from "@src/shared/validation/repository.validation";

import styles from "./repositoryForm.module.scss";

const { Title, Text } = Typography;

export const RepositoryForm = ({
  duplicate,
  checking,
  busy,
  asking,
  indexing,
  onSubmit,
  onOpenDuplicate,
  onReindexDuplicate,
}: RepositoryFormProps) => {
  const methods = useForm<RepositoryFormValues>({
    defaultValues: { url: "" },
    resolver: yupResolver(repositoryValidationSchema),
  });
  const url = useWatch({ control: methods.control, name: "url" });
  const handleChooseExample = (exampleUrl: string) =>
    methods.setValue("url", exampleUrl, { shouldValidate: true });

  return (
    <section className={styles.addPanel}>
      <Title level={3}>{repositoryStrings.ADD_TITLE}</Title>
      <Form methods={methods} onSubmit={onSubmit}>
        <div className={styles.formRow}>
          <Input
            name="url"
            placeholder={repositoryStrings.URL_PLACEHOLDER}
          />
          <Button
            htmlType={HtmlType.SUBMIT}
            type="primary"
            loading={checking}
            disabled={!url.trim() || asking || busy}
          >
            {repositoryStrings.INDEX}
          </Button>
        </div>
      </Form>

      {duplicate && (
        <div className={styles.duplicate}>
          <div className={styles.duplicateCopy}>
            <Text strong>
              {duplicate.activeSnapshot ? repositoryStrings.ALREADY_INDEXED : repositoryStrings.ALREADY_ADDED}
            </Text>
            <Text type="secondary">
              {repositoryStrings.DUPLICATE_DESCRIPTION(`${duplicate.owner}/${duplicate.name}`)}
            </Text>
          </div>
          <div className={styles.duplicateActions}>
            <Button onClick={onOpenDuplicate} disabled={busy || asking}>
              {repositoryStrings.OPEN_EXISTING}
            </Button>
            <Button onClick={onReindexDuplicate} disabled={busy || asking}>
              {repositoryStrings.REINDEX}
            </Button>
          </div>
        </div>
      )}

      <details className={styles.examples}>
        <summary>{repositoryStrings.EXPLORE_SAMPLES}</summary>
        <SupportedRepositories
          disabled={busy || asking || indexing}
          onChoose={handleChooseExample}
        />
      </details>
    </section>
  );
};
