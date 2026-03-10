import { createMiddleware } from "hono/factory";
import { getServerSpan, enrichSpan } from "@d2/service-defaults";
import type { ILogger } from "@d2/logging";
import type { IRequestContext } from "@d2/handler";
import { REQUEST_CONTEXT_KEY } from "../context-keys.js";

/**
 * Hono context variable key for the per-request child logger.
 */
export const REQUEST_LOGGER_KEY = "requestLogger" as const;

export interface RequestLoggerVariables {
  [REQUEST_LOGGER_KEY]: ILogger;
}

/**
 * Extracts non-PII fields from request context for Pino child logger bindings.
 * Mirrors .NET RequestContextLoggingMiddleware field selection.
 */
function buildLogBindings(ctx: IRequestContext): Record<string, unknown> {
  const bindings: Record<string, unknown> = {};
  if (ctx.userId) bindings.userId = ctx.userId;
  if (ctx.username) bindings.username = ctx.username;
  if (ctx.agentOrgId) bindings.agentOrgId = ctx.agentOrgId;
  if (ctx.agentOrgType) bindings.agentOrgType = ctx.agentOrgType;
  if (ctx.agentOrgRole) bindings.agentOrgRole = ctx.agentOrgRole;
  if (ctx.targetOrgId) bindings.targetOrgId = ctx.targetOrgId;
  if (ctx.targetOrgType) bindings.targetOrgType = ctx.targetOrgType;
  bindings.isAuthenticated = ctx.isAuthenticated;
  bindings.isTrustedService = ctx.isTrustedService ?? false;
  if (ctx.isAuthenticated) {
    bindings.isOrgEmulating = ctx.isOrgEmulating;
  }
  if (ctx.deviceFingerprint) bindings.deviceFingerprint = ctx.deviceFingerprint;
  if (ctx.city) bindings.city = ctx.city;
  if (ctx.countryCode) bindings.countryCode = ctx.countryCode;
  if (ctx.whoIsHashId) bindings.whoIsHashId = ctx.whoIsHashId;
  return bindings;
}

/**
 * Creates Hono middleware that creates a per-request child logger
 * enriched with non-PII request context fields.
 *
 * Runs after request enrichment so network fields are available.
 * The scope middleware further enriches with auth fields when available.
 *
 * Mirrors .NET's RequestContextLoggingMiddleware.
 */
export function createRequestContextLoggingMiddleware(logger: ILogger) {
  return createMiddleware(async (c, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestContext = (c as any).get(REQUEST_CONTEXT_KEY) as IRequestContext | undefined;

    if (requestContext) {
      c.set(REQUEST_LOGGER_KEY, logger.child(buildLogBindings(requestContext)));

      // Set OTel span attributes for Tempo trace queries.
      // Uses getServerSpan() because @hono/node-server doesn't propagate OTel async context.
      enrichSpan(getServerSpan(c), {
        userId: requestContext.userId,
        username: requestContext.username,
        agentOrgId: requestContext.agentOrgId,
        agentOrgType: requestContext.agentOrgType,
        agentOrgRole: requestContext.agentOrgRole,
        targetOrgId: requestContext.targetOrgId,
        targetOrgType: requestContext.targetOrgType,
        deviceFingerprint: requestContext.deviceFingerprint,
        city: requestContext.city,
        countryCode: requestContext.countryCode,
        whoIsHashId: requestContext.whoIsHashId,
        isAuthenticated: requestContext.isAuthenticated ?? false,
        isTrustedService: requestContext.isTrustedService ?? false,
        ...(requestContext.isAuthenticated
          ? { isOrgEmulating: requestContext.isOrgEmulating ?? false }
          : {}),
      });
    } else {
      c.set(REQUEST_LOGGER_KEY, logger);
    }

    await next();
  });
}
