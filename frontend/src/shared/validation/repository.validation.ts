import { object, string } from "yup";

import { GITHUB_REPOSITORY_URL_REGEX } from "@src/shared/utils/regex";
import { validationStrings } from "@src/constants/validation";

export const repositoryValidationSchema = object({
  url: string()
    .trim()
    .required(validationStrings.REQUIRED_REPOSITORY_URL)
    .matches(GITHUB_REPOSITORY_URL_REGEX, validationStrings.INVALID_REPOSITORY_URL),
});
