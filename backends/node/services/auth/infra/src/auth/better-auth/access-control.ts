import { createAccessControl } from "better-auth/plugins/access";

/**
 * RBAC access control configuration for D2-WORX organizations.
 *
 * Statements define resource-action pairs. Roles compose permissions
 * with inheritance: auditor → agent → officer → owner (each level
 * inherits the lower level's permissions).
 */

const statement = {
  organization: ["create", "read", "update", "delete"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "cancel"],
  businessData: ["create", "read", "update", "delete"],
  orgSettings: ["read", "update"],
  billing: ["read", "update"],
} as const;

const ac = createAccessControl(statement);

const auditorPermissions = ac.newRole({
  businessData: ["read"],
  orgSettings: ["read"],
});

const agentPermissions = ac.newRole({
  ...auditorPermissions.statements,
  businessData: ["read", "create", "update"],
});

const officerPermissions = ac.newRole({
  ...agentPermissions.statements,
  businessData: ["read", "create", "update", "delete"],
  billing: ["read", "update"],
  member: ["create", "read", "update"],
});

const ownerPermissions = ac.newRole({
  ...officerPermissions.statements,
  orgSettings: ["read", "update"],
  organization: ["read", "update", "delete"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "cancel"],
});

export { ac, auditorPermissions, agentPermissions, officerPermissions, ownerPermissions };
export type { statement };
