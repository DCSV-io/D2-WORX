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
    if (args.length > 0) this.logger.debug({ args }, msg);
    else this.logger.debug(msg);
  }

  info(msg: string, ...args: unknown[]): void {
    if (args.length > 0) this.logger.info({ args }, msg);
    else this.logger.info(msg);
  }

  warn(msg: string, ...args: unknown[]): void {
    if (args.length > 0) this.logger.warn({ args }, msg);
    else this.logger.warn(msg);
  }

  error(msg: string, ...args: unknown[]): void {
    if (args.length > 0) this.logger.error({ args }, msg);
    else this.logger.error(msg);
  }

  fatal(msg: string, ...args: unknown[]): void {
    if (args.length > 0) this.logger.fatal({ args }, msg);
    else this.logger.fatal(msg);
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new PinoLogger(this.logger.child(bindings));
  }
}
