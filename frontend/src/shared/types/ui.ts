import type { AnswerModel } from "@src/models/answer.model";

export interface AnswerMessage {
  question: string;
  result: AnswerModel;
}
