import type { Response } from "express";

const snakeCaseKey = (key: string) =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const toSnakeCase = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toSnakeCase);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      snakeCaseKey(key),
      toSnakeCase(entry),
    ]),
  );
};

export const sendJson = (response: Response, payload: unknown, status = 200) =>
  response.status(status).json(toSnakeCase(payload));
