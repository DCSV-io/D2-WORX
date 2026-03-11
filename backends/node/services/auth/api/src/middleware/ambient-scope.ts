import { createMiddleware } from "hono/factory";
import { requestContextStorage, requestLoggerStorage } from "@d2/handler";
import { REQUEST_CONTEXT_KEY } from "../context-keys.js";
import { REQUEST_LOGGER_KEY } from "./request-context-logging.js";

/**
 * Creates Hono middleware that establishes ambient per-request context
 * via AsyncLocalStorage.
 *
 * This makes HandlerContext.request and HandlerContext.logger automatically
 * return the per-request values for ALL handlers — including pre-auth
 * singletons that were constructed with static service-level defaults.
 *
 * Mirrors .NET's DI scoping where HttpContext.Features provides per-request
 * IRequestContext to every handler regardless of registration lifetime.
 *
 * Must run AFTER request enrichment, service key, and request-context-logging
 * middleware (needs both requestContext and child logger on Hono context).
 */
export function createAmbientScopeMiddleware() {
  return createMiddleware(async (c, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestContext = (c as any).get(REQUEST_CONTEXT_KEY);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logger = (c as any).get(REQUEST_LOGGER_KEY);

    if (requestContext && logger) {
      return requestContextStorage.run(requestContext, () =>
        requestLoggerStorage.run(logger, () => next()),
      );
    }
    if (requestContext) {
      return requestContextStorage.run(requestContext, () => next());
    }
    await next();
  });
}
