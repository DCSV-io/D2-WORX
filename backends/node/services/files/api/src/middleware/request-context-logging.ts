import { createMiddleware } from "hono/factory";
import type { ILogger } from "@d2/logging";
import { REQUEST_CONTEXT_KEY, REQUEST_LOGGER_KEY } from "../context-keys.js";

export { REQUEST_LOGGER_KEY };

/**
 * Creates Hono middleware that creates a child logger with request context fields.
 * Must run AFTER request enrichment (needs requestContext).
 */
export function createRequestContextLoggingMiddleware(logger: ILogger) {
  return createMiddleware(async (c, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestContext = (c as any).get(REQUEST_CONTEXT_KEY);

    if (requestContext) {
      const childLogger = logger.child({
        traceId: requestContext.traceId,
        userId: requestContext.userId,
        clientIp: requestContext.clientIp,
        path: c.req.path,
        method: c.req.method,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c as any).set(REQUEST_LOGGER_KEY, childLogger);
    }

    await next();
  });
}
