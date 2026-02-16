import type { Invitation, Role, InvitationStatus } from "@d2/auth-domain";

/**
 * Maps a BetterAuth invitation record to the domain Invitation type.
 */
export function toDomainInvitation(raw: Record<string, unknown>): Invitation {
  return {
    id: raw["id"] as string,
    email: raw["email"] as string,
    organizationId: (raw["organizationId"] ?? raw["organization_id"]) as string,
    role: (raw["role"] as Role) ?? "agent",
    status: (raw["status"] as InvitationStatus) ?? "pending",
    inviterId: (raw["inviterId"] ?? raw["inviter_id"]) as string,
    expiresAt: toDate(raw["expiresAt"] ?? raw["expires_at"]),
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
