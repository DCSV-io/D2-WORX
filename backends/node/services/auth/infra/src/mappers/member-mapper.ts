import type { Member, Role } from "@d2/auth-domain";

/**
 * Maps a BetterAuth member record to the domain Member type.
 */
export function toDomainMember(raw: Record<string, unknown>): Member {
  return {
    id: raw["id"] as string,
    userId: (raw["userId"] ?? raw["user_id"]) as string,
    organizationId: (raw["organizationId"] ?? raw["organization_id"]) as string,
    role: (raw["role"] as Role) ?? "agent",
    createdAt: toDate(raw["createdAt"] ?? raw["created_at"]),
  };
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return new Date();
}
