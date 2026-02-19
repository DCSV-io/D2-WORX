/**
 * Role of a participant within a thread.
 *
 * Hierarchy (higher = more privilege):
 * - observer (0) — read-only access
 * - participant (1) — can post messages
 * - moderator (2) — can manage messages and participants
 * - creator (3) — full thread control
 */

export const PARTICIPANT_ROLES = ["observer", "participant", "moderator", "creator"] as const;

export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export function isValidParticipantRole(value: unknown): value is ParticipantRole {
  return typeof value === "string" && PARTICIPANT_ROLES.includes(value as ParticipantRole);
}

/**
 * Numeric hierarchy for role comparisons. Higher = more privilege.
 */
export const PARTICIPANT_ROLE_HIERARCHY: Readonly<Record<ParticipantRole, number>> = {
  observer: 0,
  participant: 1,
  moderator: 2,
  creator: 3,
};
