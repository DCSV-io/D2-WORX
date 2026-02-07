import type { ILogger } from "@d2/logging";
import type { IHandlerContext } from "./i-handler-context.js";
import type { IRequestContext } from "./i-request-context.js";

/**
 * Default implementation of IHandlerContext.
 */
export class HandlerContext implements IHandlerContext {
  constructor(
    public readonly request: IRequestContext,
    public readonly logger: ILogger,
  ) {}
}
