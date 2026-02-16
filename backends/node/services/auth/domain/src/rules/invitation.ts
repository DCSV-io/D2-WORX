import type { Invitation } from "../entities/invitation.js";
import type { InvitationStatus } from "../enums/invitation-status.js";
import { INVITATION_TRANSITIONS } from "../enums/invitation-status.js";
import { AuthDomainError } from "../exceptions/auth-domain-error.js";

/**
 * Transitions an invitation to a new status according to the state machine.
 * Throws AuthDomainError if the transition is invalid.
 *
 * @returns A new invitation object with the updated status.
 */
export function transitionInvitationStatus(
  invitation: Invitation,
  newStatus: InvitationStatus,
): Invitation {
  const validNextStatuses = INVITATION_TRANSITIONS[invitation.status];

  if (!validNextStatuses.includes(newStatus)) {
    throw new AuthDomainError(
      `Invalid invitation status transition from '${invitation.status}' to '${newStatus}'.`,
    );
  }

  return {
    ...invitation,
    status: newStatus,
  };
}

/**
 * Checks whether an invitation has expired based on its expiresAt date.
 */
export function isInvitationExpired(invitation: Invitation): boolean {
  return invitation.expiresAt.getTime() <= Date.now();
}
