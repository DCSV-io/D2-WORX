import type { OrgType } from "./org-type.js";
import type { UserToOrgRelationship } from "./user-to-org-relationship.js";

/**
 * Represents the context of a request, including tracing information,
 * user identity, and organizational details.
 * Mirrors D2.Shared.Handler.IRequestContext in .NET.
 */
export interface IRequestContext {
  // Tracing
  traceId?: string;
  requestId?: string;
  requestPath?: string;

  // User / Identity
  isAuthenticated: boolean;
  userId?: string;
  username?: string;

  // Agent Organization
  agentOrgId?: string;
  agentOrgName?: string;
  agentOrgType?: OrgType;

  // Target Organization
  targetOrgId?: string;
  targetOrgName?: string;
  targetOrgType?: OrgType;

  // Helpers (computed)
  userToTargetRelationship?: UserToOrgRelationship;
  isAgentStaff: boolean;
  isAgentAdmin: boolean;
  isTargetingStaff: boolean;
  isTargetingAdmin: boolean;
}
