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
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  username?: string;

  // Agent Organization
  agentOrgId?: string;
  agentOrgName?: string;
  agentOrgType?: OrgType;

  // Target Organization
  targetOrgId?: string;
  targetOrgName?: string;
  targetOrgType?: OrgType;

  // Org Emulation
  isOrgEmulating: boolean;

  // User Impersonation
  impersonatedBy?: string;
  impersonatingEmail?: string;
  impersonatingUsername?: string;
  isUserImpersonating: boolean;

  // Helpers (computed)
  isAgentStaff: boolean;
  isAgentAdmin: boolean;
  isTargetingStaff: boolean;
  isTargetingAdmin: boolean;
}
