import winston from "winston";

export type ApplicationLogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

type LoggerMetadata = Record<string, unknown>;

const logLevelMap: Record<ApplicationLogLevel, string> = {
  fatal: "error",
  error: "error",
  warn: "warn",
  info: "info",
  debug: "debug",
  trace: "silly",
  silent: "info",
};

const rootLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "codebase-assistant-backend" },
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

export const configureLogger = (level: ApplicationLogLevel) => {
  const silent = level === "silent";

  const winstonLevel = logLevelMap[level];
  rootLogger.level = winstonLevel;
  for (const transport of rootLogger.transports) {
    transport.level = winstonLevel;
    transport.silent = silent;
  }
};

export const createLogger = (metadata: LoggerMetadata = {}) =>
  rootLogger.child(metadata);

export const logger = createLogger();
