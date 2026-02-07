import type { ILogger } from "@d2/logging";
import type { IRequestContext } from "./i-request-context.js";

/**
 * Context for handlers, providing access to the request context and logging.
 * Mirrors D2.Shared.Handler.IHandlerContext in .NET.
 */
export interface IHandlerContext {
  request: IRequestContext;
  logger: ILogger;
}
