import type { Session } from "../entities/session.js";
import type { OrgType } from "../enums/org-type.js";
import type { SessionContext } from "../value-objects/session-context.js";

/**
 * Resolves the effective session context, accounting for emulation.
 *
 * If the session has an emulatedOrganizationId, the effective context uses the
 * emulated org's fields and forces the role to "auditor" (read-only access).
 */
export function resolveSessionContext(session: Session): SessionContext {
  const isEmulating = session.emulatedOrganizationId !== null;

  if (isEmulating) {
    return {
      userId: session.userId,
      effectiveOrgId: session.emulatedOrganizationId,
      effectiveOrgType: session.emulatedOrganizationType,
      effectiveRole: "auditor",
      isEmulating: true,
    };
  }

  return {
    userId: session.userId,
    effectiveOrgId: session.activeOrganizationId,
    effectiveOrgType: session.activeOrganizationType,
    effectiveRole: session.activeOrganizationRole,
    isEmulating: false,
  };
}

/**
 * Checks whether the given org type is allowed to emulate another organization.
 * Only "support" and "admin" org types can emulate.
 */
export function canEmulate(activeOrgType: OrgType): boolean {
  return activeOrgType === "support" || activeOrgType === "admin";
}
