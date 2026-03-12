import type { ILogger } from "@d2/logging";
import type { IHandlerContext } from "./i-handler-context.js";
import type { IRequestContext } from "./i-request-context.js";
import { requestContextStorage, requestLoggerStorage } from "./ambient-context.js";

/**
 * Default implementation of IHandlerContext.
 *
 * Checks ambient per-request storage first (set by middleware), then falls
 * back to the constructor-provided values (from DI or service-level defaults).
 *
 * This means ALL handlers — including pre-auth singletons — automatically
 * get per-request context and logger when ambient storage is active.
 * Mirrors .NET's DI scoping where HttpContext.Features provides per-request
 * IRequestContext to all handlers regardless of registration lifetime.
 */
export class HandlerContext implements IHandlerContext {
  private readonly _request: IRequestContext;
  private readonly _logger: ILogger;

  constructor(request: IRequestContext, logger: ILogger) {
    this._request = request;
    this._logger = logger;
  }

  get request(): IRequestContext {
    return requestContextStorage.getStore() ?? this._request;
  }

  get logger(): ILogger {
    return requestLoggerStorage.getStore() ?? this._logger;
  }
}
