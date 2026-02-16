import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { D2Result, HttpStatusCode } from "@d2/result";
import {
  SESSION_FIELDS,
  ROLE_HIERARCHY,
  isValidOrgType,
  isValidRole,
  type OrgType,
  type Role,
} from "@d2/auth-domain";
import type { SessionVariables } from "./session.js";

/**
 * Requires an active organization in the session.
 * Rejects with 403 if activeOrganizationId, activeOrganizationType,
 * or activeOrganizationRole are missing.
 */
export function requireOrg() {
  return createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
    const session = c.get("session");
    if (!session) {
      return c.json(D2Result.unauthorized(), 401 as ContentfulStatusCode);
    }

    const orgId = session[SESSION_FIELDS.ACTIVE_ORG_ID] as string | undefined;
    const orgType = session[SESSION_FIELDS.ACTIVE_ORG_TYPE];
    const role = session[SESSION_FIELDS.ACTIVE_ORG_ROLE];

    if (!orgId || !isValidOrgType(orgType) || !isValidRole(role)) {
      return c.json(
        D2Result.fail({
          messages: ["No active organization. Join or create an organization first."],
          statusCode: HttpStatusCode.Forbidden,
        }),
        403 as ContentfulStatusCode,
      );
    }

    await next();
  });
}

/**
 * Requires the session's active org to be one of the allowed types.
 * Should be used after requireOrg() or session middleware.
 */
export function requireOrgType(...allowed: OrgType[]) {
  const allowedSet = new Set<string>(allowed);

  return createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
    const session = c.get("session");
    if (!session) {
      return c.json(D2Result.unauthorized(), 401 as ContentfulStatusCode);
    }

    const orgType = session[SESSION_FIELDS.ACTIVE_ORG_TYPE] as string | undefined;
    if (!orgType || !allowedSet.has(orgType)) {
      return c.json(
        D2Result.fail({
          messages: [`Organization type not authorized. Allowed: ${allowed.join(", ")}.`],
          statusCode: HttpStatusCode.Forbidden,
        }),
        403 as ContentfulStatusCode,
      );
    }

    await next();
  });
}

/**
 * Requires the session's active role to be at or above minRole in the hierarchy.
 * Hierarchy (low → high): auditor < agent < officer < owner.
 */
export function requireRole(minRole: Role) {
  const minLevel = ROLE_HIERARCHY[minRole];

  return createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
    const session = c.get("session");
    if (!session) {
      return c.json(D2Result.unauthorized(), 401 as ContentfulStatusCode);
    }

    const role = session[SESSION_FIELDS.ACTIVE_ORG_ROLE] as string | undefined;
    if (!isValidRole(role) || ROLE_HIERARCHY[role] < minLevel) {
      return c.json(
        D2Result.fail({
          messages: [`Insufficient role. Minimum required: ${minRole}.`],
          statusCode: HttpStatusCode.Forbidden,
        }),
        403 as ContentfulStatusCode,
      );
    }

    await next();
  });
}

/** Shorthand: requireOrgType("admin", "support"). */
export function requireStaff() {
  return requireOrgType("admin", "support");
}

/** Shorthand: requireOrgType("admin"). */
export function requireAdmin() {
  return requireOrgType("admin");
}
