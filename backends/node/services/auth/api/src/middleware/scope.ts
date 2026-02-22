import { createMiddleware } from "hono/factory";
import type { ServiceProvider, ServiceScope } from "@d2/di";
import { IRequestContextKey, IHandlerContextKey } from "@d2/handler";
import { HandlerContext } from "@d2/handler";
import { ILoggerKey } from "@d2/logging";
import type { IRequestContext, OrgType } from "@d2/handler";
import { SESSION_FIELDS } from "@d2/auth-domain";
import type { SessionVariables } from "./session.js";

/**
 * Hono context variable key for the DI scope.
 * Use this constant instead of the magic string "scope" everywhere.
 */
export const SCOPE_KEY = "scope" as const;

/**
 * Hono Variables set by the scope middleware.
 */
export interface ScopeVariables {
  [SCOPE_KEY]: ServiceScope;
}

/**
 * Maps auth-domain org type strings (lowercase) to handler OrgType enum values.
 */
const ORG_TYPE_MAP: Record<string, OrgType> = {
  admin: "Admin" as OrgType,
  support: "Support" as OrgType,
  customer: "Customer" as OrgType,
  third_party: "ThirdParty" as OrgType,
  affiliate: "Affiliate" as OrgType,
};

function toHandlerOrgType(domainOrgType: string | undefined): OrgType | undefined {
  if (!domainOrgType) return undefined;
  return ORG_TYPE_MAP[domainOrgType];
}

/**
 * Builds an IRequestContext from Hono context variables.
 * Mirrors .NET's RequestContext population from HttpContext.
 *
 * Before auth: only traceId is available.
 * After auth: user, session, and org fields are populated.
 */
function buildRequestContext(
  user: SessionVariables["user"],
  session: SessionVariables["session"],
): IRequestContext {
  const domainOrgType = session?.[SESSION_FIELDS.ACTIVE_ORG_TYPE] as string | undefined;
  const orgType = toHandlerOrgType(domainOrgType);
  const emulatedOrgId = session?.[SESSION_FIELDS.EMULATED_ORG_ID] as string | undefined;
  const domainEmulatedOrgType = session?.[SESSION_FIELDS.EMULATED_ORG_TYPE] as string | undefined;
  const emulatedOrgType = toHandlerOrgType(domainEmulatedOrgType);
  const isOrgEmulating = !!emulatedOrgId;

  return {
    traceId: crypto.randomUUID(),
    isAuthenticated: !!user,
    userId: user?.id,
    email: user?.email,
    agentOrgId: session?.[SESSION_FIELDS.ACTIVE_ORG_ID] as string | undefined,
    agentOrgType: orgType,
    targetOrgId: isOrgEmulating
      ? emulatedOrgId
      : (session?.[SESSION_FIELDS.ACTIVE_ORG_ID] as string | undefined),
    targetOrgType: isOrgEmulating ? emulatedOrgType : orgType,
    isOrgEmulating,
    isUserImpersonating: false,
    isAgentStaff: domainOrgType === "admin" || domainOrgType === "support",
    isAgentAdmin: domainOrgType === "admin",
    isTargetingStaff: isOrgEmulating
      ? domainEmulatedOrgType === "admin" || domainEmulatedOrgType === "support"
      : domainOrgType === "admin" || domainOrgType === "support",
    isTargetingAdmin: isOrgEmulating
      ? domainEmulatedOrgType === "admin"
      : domainOrgType === "admin",
  };
}

/**
 * Creates Hono middleware that establishes a DI scope per request.
 *
 * The scope contains:
 * - IRequestContext (built from session data)
 * - IHandlerContext (wraps IRequestContext + ILogger)
 *
 * Routes resolve handlers from `c.get(SCOPE_KEY)`.
 * The scope is disposed after the request completes.
 */
export function createScopeMiddleware(provider: ServiceProvider) {
  return createMiddleware<{ Variables: SessionVariables & ScopeVariables }>(async (c, next) => {
    const scope = provider.createScope();
    try {
      // Build IRequestContext from session data (populated by session middleware upstream)
      const user = c.get("user") as SessionVariables["user"] | undefined;
      const session = c.get("session") as SessionVariables["session"] | undefined;
      const requestContext = buildRequestContext(user ?? null, session ?? null);

      scope.setInstance(IRequestContextKey, requestContext);

      // Build IHandlerContext — scoped (new per request)
      const logger = provider.resolve(ILoggerKey);
      scope.setInstance(IHandlerContextKey, new HandlerContext(requestContext, logger));

      c.set(SCOPE_KEY, scope);
      await next();
    } finally {
      scope.dispose();
    }
  });
}
