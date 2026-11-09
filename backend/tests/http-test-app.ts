import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import type { Express } from "express";

type Input = string | {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  payload?: unknown;
};

interface TestJson {
  [key: string]: TestJson | string | number | boolean | null | undefined;
  id: string;
  job: TestJson;
  repo: TestJson;
  paths: TestJson;
  node_limit: number;
  relationship_limit: number;
  reason: string;
  migrations_ready: boolean;
  worker_ready: boolean;
  status: string;
  code: string;
  leaseOwner?: undefined;
}

interface InjectResponse {
  statusCode: number;
  body: string;
  json: () => TestJson;
}

export const createTestApp = async (app: Express) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;

  return {
    async inject(input: Input) {
      const options = typeof input === "string" ? { url: input } : input;

      const headers = { ...options.headers };
      headers.host ??= `127.0.0.1:${address.port}`;
      if (options.payload !== undefined && !headers["content-type"])
        headers["content-type"] = "application/json";

      return new Promise<InjectResponse>((resolve, reject) => {
        const request = httpRequest(
          {
            hostname: "127.0.0.1",
            port: address.port,
            path: options.url,
            method: options.method ?? "GET",
            headers,
            setHost: false,
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf8");
              resolve({
                statusCode: response.statusCode ?? 500,
                body,
                json: () => JSON.parse(body) as TestJson,
              });
            });
          },
        );
        request.on("error", reject);
        request.end(
          options.payload === undefined
            ? undefined
            : JSON.stringify(options.payload),
        );
      });
    },
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await app.locals.shutdown?.();
    },
  };
};
