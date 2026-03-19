import { createMiddleware } from "hono/factory";
import { requestContextStorage, requestLoggerStorage } from "@d2/handler";
import { REQUEST_CONTEXT_KEY, REQUEST_LOGGER_KEY } from "../context-keys.js";

/**
 * Creates Hono middleware that establishes ambient per-request context
 * via AsyncLocalStorage.
 *
 * This makes HandlerContext.request and HandlerContext.logger automatically
 * return the per-request values for ALL handlers — including pre-auth
 * singletons that were constructed with static service-level defaults.
 *
 * Must run AFTER request enrichment middleware.
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
