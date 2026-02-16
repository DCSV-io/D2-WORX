/**
 * Organization membership roles.
 *
 * Stored as plain text in PostgreSQL (NOT PG enums).
 * TypeScript string unions provide compile-time safety.
 */

export const ROLES = ["owner", "officer", "agent", "auditor"] as const;

export type Role = (typeof ROLES)[number];

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

/**
 * Role hierarchy — higher numeric value means more privileges.
 * Used to determine if one role outranks another.
 */
export const ROLE_HIERARCHY: Readonly<Record<Role, number>> = {
  auditor: 0,
  agent: 1,
  officer: 2,
  owner: 3,
};
