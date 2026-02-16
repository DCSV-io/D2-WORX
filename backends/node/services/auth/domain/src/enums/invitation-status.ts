/**
 * Invitation lifecycle statuses.
 *
 * Uses a state machine pattern — only specific transitions are valid.
 */

export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "canceled",
  "expired",
] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export function isValidInvitationStatus(value: unknown): value is InvitationStatus {
  return typeof value === "string" && INVITATION_STATUSES.includes(value as InvitationStatus);
}

/**
 * Valid state transitions for invitation status.
 * Key = current status, Value = set of valid next statuses.
 *
 * Terminal states (accepted, rejected, canceled, expired) have no valid transitions.
 */
export const INVITATION_TRANSITIONS: Readonly<
  Record<InvitationStatus, readonly InvitationStatus[]>
> = {
  pending: ["accepted", "rejected", "canceled", "expired"],
  accepted: [],
  rejected: [],
  canceled: [],
  expired: [],
};
