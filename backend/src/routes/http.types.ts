import type { Request } from "express";
import type { ParsedQs } from "qs";
import type { ParamsDictionary } from "express-serve-static-core";

export interface IdParams {
  id: string;
}

export interface RepositoryBody {
  url: string;
}

export interface SymbolQuery {
  name: string;
}

export interface QuestionBody {
  question: string;
  conversation_id?: string;
  snapshot_id?: string;
}

export type IdRequest = Request<ParamsDictionary, unknown, unknown, ParsedQs>;

export const routeId = (request: IdRequest) => request.params.id as string;

export type SubmitRepositoryRequest = Request<
  ParamsDictionary,
  unknown,
  RepositoryBody,
  ParsedQs
>;

export type SymbolRequest = Request<ParamsDictionary, unknown, unknown, ParsedQs>;

export type QuestionRequest = Request<ParamsDictionary, unknown, QuestionBody, ParsedQs>;
