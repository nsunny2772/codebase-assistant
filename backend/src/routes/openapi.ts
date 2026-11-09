const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
};

const idGet = (description: string) => ({
  parameters: [idParameter],
  responses: { "200": { description } },
});

const idPost = (description: string, status = "202") => ({
  parameters: [idParameter],
  responses: { [status]: { description } },
});

export const openApiDocument = {
  openapi: "3.0.3",
  info: { title: "AI Codebase Assistant API", version: "0.1.0" },
  paths: {
    "/health/live": {
      get: { responses: { "200": { description: "API liveness" } } },
    },
    "/health/ready": {
      get: {
        responses: {
          "200": { description: "API is ready" },
          "503": { description: "API is not ready" },
        },
      },
    },
    "/v1/openapi.json": {
      get: { responses: { "200": { description: "OpenAPI document" } } },
    },
    "/v1/capacity": {
      get: { responses: { "200": { description: "Graph capacity" } } },
    },
    "/v1/capabilities": {
      get: { responses: { "200": { description: "Analysis capabilities" } } },
    },
    "/v1/repositories": {
      get: { responses: { "200": { description: "Repository list" } } },
      post: {
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: { url: { type: "string", maxLength: 300 } },
                additionalProperties: false,
              },
            },
          },
        },
        responses: { "202": { description: "Repository indexing queued" } },
      },
    },
    "/v1/repositories/{id}": {
      get: idGet("Repository details"),
      delete: {
        parameters: [idParameter],
        responses: { "204": { description: "Repository deleted" } },
      },
    },
    "/v1/repositories/{id}/jobs": {
      get: idGet("Repository indexing jobs"),
    },
    "/v1/repositories/{id}/chunks": {
      get: idGet("Indexed file chunk counts"),
    },
    "/v1/repositories/{id}/refresh": {
      post: idPost("Repository reindex queued"),
    },
    "/v1/repositories/{id}/symbols": {
      get: {
        parameters: [
          idParameter,
          {
            name: "name",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 1, maxLength: 200 },
          },
        ],
        responses: { "200": { description: "Matching repository symbols" } },
      },
    },
    "/v1/repositories/{id}/questions": {
      post: {
        parameters: [idParameter],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["question"],
                properties: {
                  question: { type: "string", minLength: 1, maxLength: 8000 },
                  conversation_id: { type: "string" },
                  snapshot_id: { type: "string" },
                },
                additionalProperties: false,
              },
            },
          },
        },
        responses: { "200": { description: "Source-backed answer with citations" } },
      },
    },
    "/v1/jobs/{id}": { get: idGet("Indexing job status") },
    "/v1/jobs/{id}/cancel": {
      post: idPost("Job cancellation requested", "204"),
    },
  },
} as const;
