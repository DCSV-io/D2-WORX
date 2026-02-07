import type { LogLevel } from "./i-logger.js";

/**
 * Configuration options for creating a logger instance.
 */
export interface LoggerOptions {
  /** Minimum log level. Default: "info". */
  level?: LogLevel;
  /** Service name added to every log line as a base binding. */
  serviceName?: string;
  /** Enable human-readable dev output (pino-pretty). Default: false. */
  pretty?: boolean;
}
