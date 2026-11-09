import { object, string } from "yup";

import { validationStrings } from "@src/constants/validation";

export const questionValidationSchema = object({
  question: string()
    .trim()
    .required(validationStrings.REQUIRED_QUESTION)
    .max(8000, validationStrings.QUESTION_TOO_LONG),
});
