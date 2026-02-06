import type pino from "pino";
import type { ILogger } from "./i-logger.js";

/**
 * ILogger implementation backed by Pino.
 * Wraps a pino.Logger instance and delegates all calls to it.
 */
export class PinoLogger implements ILogger {
  private readonly logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  debug(msg: string, ...args: unknown[]): void {
    this.logger.debug(msg, ...args);
  }

  info(msg: string, ...args: unknown[]): void {
    this.logger.info(msg, ...args);
  }

  warn(msg: string, ...args: unknown[]): void {
    this.logger.warn(msg, ...args);
  }

  error(msg: string, ...args: unknown[]): void {
    this.logger.error(msg, ...args);
  }

  fatal(msg: string, ...args: unknown[]): void {
    this.logger.fatal(msg, ...args);
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new PinoLogger(this.logger.child(bindings));
  }
}
