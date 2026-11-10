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

export const exploreRepositoryQuery = yup.object({
  query: yup.string().trim().min(2).max(100).required(),
  language: yup
    .string()
    .oneOf(["JavaScript", "TypeScript", "Python", "Go", "Java", "Rust", "C#"])
    .optional(),
  sort: yup.string().oneOf(["stars", "updated"]).default("stars"),
  page: yup.number().integer().min(1).max(100).default(1),
}).noUnknown();
