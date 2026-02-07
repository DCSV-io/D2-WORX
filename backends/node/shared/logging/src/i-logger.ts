/**
 * Log level enumeration matching common logging frameworks.
 */
export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
  Fatal = "fatal",
  Silent = "silent",
}

/**
 * Logger interface decoupled from any specific logging library.
 * Consumers depend on this interface, never on Pino directly.
 */
export interface ILogger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  fatal(msg: string, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): ILogger;
}
