import { AppError } from "../utils/app-error.js";
import { answerStrings } from "../constants/answer.js";
import { answerQuestion } from "./workflow/answer.js";
import {
  requireStore,
  requireAI,
  type ServiceDependencies,
} from "./dependencies.js";
import type { RepositoryService } from "./repositories.service.js";

export interface QuestionInput {
  question: string;
  conversationId?: string;
  snapshotId?: string;
}

export const createQuestionService = (
  dependencies: ServiceDependencies,
  repositories: RepositoryService,
) => {
  const ask = async (
    repoId: string,
    input: QuestionInput,
    signal: AbortSignal,
  ) => {
    const repo = await repositories.getRepository(repoId);
    if (!input.question.trim())
      throw new AppError("INVALID_QUESTION", answerStrings.INVALID_QUESTION);
    return answerQuestion(
      requireStore(dependencies),
      requireAI(dependencies),
      dependencies.config,
      repo,
      input.question,
      input.conversationId ?? "default",
      input.snapshotId ?? repo.activeSnapshot,
      signal,
    );
  };
  return { ask };
};

export type QuestionService = ReturnType<typeof createQuestionService>;
