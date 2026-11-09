import type { QuestionService } from "../services/questions.service.js";
import { routeId, type QuestionRequest } from "../routes/http.types.js";
import type { Response } from "express";
import { sendJson } from "../routes/serializers.js";

export const QuestionController = (service: QuestionService) => {
  const { ask: askQuestion } = service;

  const askAboutRepository = async (
    request: QuestionRequest,
    response: Response,
  ) => {
    const controller = new AbortController();

    const handleAbort = () => controller.abort();
    request.once("aborted", handleAbort);
    try {
      return sendJson(
        response,
        await askQuestion(
          routeId(request),
          {
            question: request.body.question,
            conversationId: request.body.conversation_id,
            snapshotId: request.body.snapshot_id,
          },
          controller.signal,
        ),
      );
    } finally {
      request.off("aborted", handleAbort);
    }
  };
  return { askAboutRepository };
};
