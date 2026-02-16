import type { OrgType } from "../enums/org-type.js";
import type { Role } from "../enums/role.js";

/**
 * Computed session context — not persisted.
 *
 * Resolves the "effective" org context by accounting for emulation.
 * When emulating, the effective org is the emulated one and the role is forced to "auditor".
 */
export interface SessionContext {
  readonly userId: string;
  readonly effectiveOrgId: string | null;
  readonly effectiveOrgType: OrgType | null;
  readonly effectiveRole: Role | null;
  readonly isEmulating: boolean;
}
