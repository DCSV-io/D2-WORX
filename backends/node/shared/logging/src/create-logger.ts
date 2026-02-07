import pino from "pino";
import { LogLevel, type ILogger } from "./i-logger.js";
import type { LoggerOptions } from "./logger-options.js";
import { PinoLogger } from "./pino-logger.js";

/**
 * Creates an ILogger instance backed by Pino.
 *
 * When `@opentelemetry/instrumentation-pino` is active (via `@d2/service-defaults`),
 * all log calls automatically get trace context injected and forwarded to the
 * OTel log pipeline. No code changes needed here.
 */
export function createLogger(options?: LoggerOptions): ILogger {
  const level = options?.level ?? LogLevel.Info;

  const pinoOptions: pino.LoggerOptions = {
    level,
  };

  if (options?.pretty) {
    pinoOptions.transport = {
      target: "pino-pretty",
      options: { colorize: true },
    };
  }

  const baseBindings: Record<string, unknown> = {};
  if (options?.serviceName) {
    baseBindings.serviceName = options.serviceName;
  }

  const logger = pino(pinoOptions);

  // If we have base bindings, create a child logger with them
  const boundLogger = Object.keys(baseBindings).length > 0 ? logger.child(baseBindings) : logger;

  return new PinoLogger(boundLogger);
}
