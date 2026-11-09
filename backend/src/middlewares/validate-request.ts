import type { RequestHandler } from "express";
import type { AnyObjectSchema } from "yup";

export const validateRequest = (
  target: "body" | "params" | "query",
  schema: AnyObjectSchema,
): RequestHandler =>
  async (request, _response, next) => {
    try {
      const validated = await schema.validate(request[target], {
        abortEarly: false,
        stripUnknown: true,
      });
      if (target === "body") request.body = validated;
      if (target === "params") request.params = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
