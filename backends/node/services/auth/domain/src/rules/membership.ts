import type { Member } from "../entities/member.js";

/**
 * Checks whether the given user is the last owner in the member list.
 * Used to prevent leaving an organization without any owners.
 */
export function isLastOwner(members: readonly Member[], userId: string): boolean {
  const owners = members.filter((m) => m.role === "owner");
  return owners.length === 1 && owners[0]!.userId === userId;
}

/**
 * Checks whether the given user is a member of the specified organization.
 */
export function isMemberOfOrg(
  members: readonly Member[],
  userId: string,
  organizationId: string,
): boolean {
  return members.some((m) => m.userId === userId && m.organizationId === organizationId);
}
