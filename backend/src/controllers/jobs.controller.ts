import type { Response } from "express";

import type { JobService } from "../services/jobs.service.js";
import { routeId, type IdRequest } from "../routes/http.types.js";
import { toJobResponse } from "./job-response.js";
import { sendJson } from "../routes/serializers.js";

export const JobController = (service: JobService) => {
  const {
    get: getJobById,
    list: listJobsForRepository,
    cancel: cancelJobById,
  } = service;

  const getJob = async (request: IdRequest, response: Response) =>
    sendJson(response, {
      job: toJobResponse(await getJobById(routeId(request))),
    });

  const getRepositoryJobs = async (request: IdRequest, response: Response) =>
    sendJson(response, {
      jobs: (await listJobsForRepository(routeId(request))).map(toJobResponse),
    });

  const cancelJob = async (request: IdRequest, response: Response) => {
    await cancelJobById(routeId(request));
    return response.sendStatus(204);
  };
  return { getJob, getRepositoryJobs, cancelJob };
};
