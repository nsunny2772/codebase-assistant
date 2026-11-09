import type { Request, Response } from "express";

import type { SystemService } from "../services/system.service.js";
import { openApiDocument } from "../routes/openapi.js";
import { sendJson } from "../routes/serializers.js";

export const SystemController = (service: SystemService) => {
  const {
    capacity: getCapacity,
    capabilities: getCapabilities,
    live: getLiveStatus,
    ready: getReadyStatus,
  } = service;

  const getOpenApiDocument = async (_request: Request, response: Response) =>
    response.status(200).json(openApiDocument);

  const getSystemCapacity = async (_request: Request, response: Response) =>
    sendJson(response, await getCapacity());

  const getSystemCapabilities = async (_request: Request, response: Response) =>
    sendJson(response, getCapabilities());

  const getLiveness = async (_request: Request, response: Response) =>
    sendJson(response, getLiveStatus());

  const getReadiness = async (_request: Request, response: Response) => {
    const result = await getReadyStatus();
    return sendJson(response, result, result.status === "ready" ? 200 : 503);
  };
  return {
    getOpenApiDocument,
    getSystemCapacity,
    getSystemCapabilities,
    getLiveness,
    getReadiness,
  };
};
