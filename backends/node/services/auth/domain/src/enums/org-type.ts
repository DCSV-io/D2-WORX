/**
 * Organization types in the D2-WORX system.
 *
 * Stored as plain text in PostgreSQL (NOT PG enums).
 * TypeScript string unions provide compile-time safety.
 */

export const ORG_TYPES = ["admin", "support", "customer", "third_party", "affiliate"] as const;

export type OrgType = (typeof ORG_TYPES)[number];

export function isValidOrgType(value: unknown): value is OrgType {
  return typeof value === "string" && ORG_TYPES.includes(value as OrgType);
}
