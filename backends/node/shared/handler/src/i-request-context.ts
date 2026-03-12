import type { OrgType } from "./org-type.js";

/**
 * Represents the context of a request, including tracing information,
 * user identity, and organizational details.
 * Mirrors D2.Shared.Handler.IRequestContext in .NET.
 *
 * **Agent org** = the user's actual org membership. Only changes during
 * **user impersonation** (admin acting as another user).
 *
 * **Target org** = the org all operations execute against. Always populated for
 * authenticated users with org context. Equals the emulated org during
 * **org emulation**, otherwise equals the agent org.
 *
 * Downstream logic should always use target org fields for authorization and
 * data scoping. Agent org fields are for audit/identity context only.
 */
export interface IRequestContext {
  // Tracing
  traceId?: string;
  requestId?: string;
  requestPath?: string;

  // User / Identity
  /**
   * Whether the user is authenticated. `null` means auth hasn't run yet
   * (pre-auth handlers). Set to `true`/`false` by auth middleware.
   */
  isAuthenticated: boolean | null;
  userId?: string;
  email?: string;
  username?: string;

  // Agent Organization
  agentOrgId?: string;
  agentOrgName?: string;
  agentOrgType?: OrgType;
  agentOrgRole?: string;

  // Target Organization
  targetOrgId?: string;
  targetOrgName?: string;
  targetOrgType?: OrgType;
  targetOrgRole?: string;

  // Org Emulation
  /** `null` = auth hasn't run yet. */
  isOrgEmulating: boolean | null;

  // User Impersonation
  impersonatedBy?: string;
  impersonatingEmail?: string;
  impersonatingUsername?: string;
  /** `null` = auth hasn't run yet. */
  isUserImpersonating: boolean | null;

  // Network / Enrichment
  clientIp?: string;
  serverFingerprint?: string;
  clientFingerprint?: string;
  deviceFingerprint?: string;
  whoIsHashId?: string;
  city?: string;
  countryCode?: string;
  subdivisionCode?: string;
  isVpn?: boolean;
  isProxy?: boolean;
  isTor?: boolean;
  isHosting?: boolean;

  // Trust
  /**
   * Whether the request is from a trusted service. `null` = service-key
   * middleware hasn't run yet. Set to `true`/`false` after service-key check.
   */
  isTrustedService: boolean | null;

  // Helpers (computed)
  isAgentStaff?: boolean;
  isAgentAdmin?: boolean;
  isTargetingStaff?: boolean;
  isTargetingAdmin?: boolean;
}
