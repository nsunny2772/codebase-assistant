import * as yup from "yup";

export const idParams = yup.object({
  id: yup.string().matches(/^[a-zA-Z0-9-]{1,100}$/).required(),
}).noUnknown();

export const repositoryBody = yup.object({
  url: yup.string().max(300).required(),
}).noUnknown();

export const symbolQuery = yup.object({
  name: yup.string().min(1).max(200).required(),
});

export const questionBody = yup.object({
  question: yup.string().min(1).max(8000).required(),
  conversation_id: yup.string().matches(/^[a-zA-Z0-9-]{1,100}$/).optional(),
  snapshot_id: yup.string().matches(/^[a-f0-9]{64}$/).optional(),
}).noUnknown();
