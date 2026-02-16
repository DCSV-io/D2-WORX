import { cleanAndValidateEmail, generateUuidV7 } from "@d2/utilities";
import type { Role } from "../enums/role.js";
import { isValidRole } from "../enums/role.js";
import type { InvitationStatus } from "../enums/invitation-status.js";
import { AuthValidationError } from "../exceptions/auth-validation-error.js";

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly organizationId: string;
  readonly role: Role;
  readonly status: InvitationStatus;
  readonly inviterId: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface CreateInvitationInput {
  readonly email: string;
  readonly organizationId: string;
  readonly role: Role;
  readonly inviterId: string;
  readonly expiresAt: Date;
  readonly id?: string;
}

export function createInvitation(input: CreateInvitationInput): Invitation {
  const email = cleanAndValidateEmail(input.email);

  if (!input.organizationId) {
    throw new AuthValidationError(
      "Invitation",
      "organizationId",
      input.organizationId,
      "is required.",
    );
  }

  if (!isValidRole(input.role)) {
    throw new AuthValidationError("Invitation", "role", input.role, "is not a valid role.");
  }

  if (!input.inviterId) {
    throw new AuthValidationError("Invitation", "inviterId", input.inviterId, "is required.");
  }

  if (!(input.expiresAt instanceof Date) || isNaN(input.expiresAt.getTime())) {
    throw new AuthValidationError(
      "Invitation",
      "expiresAt",
      input.expiresAt,
      "must be a valid date.",
    );
  }

  if (input.expiresAt.getTime() <= Date.now()) {
    throw new AuthValidationError(
      "Invitation",
      "expiresAt",
      input.expiresAt,
      "must be in the future.",
    );
  }

  return {
    id: input.id ?? generateUuidV7(),
    email,
    organizationId: input.organizationId,
    role: input.role,
    status: "pending",
    inviterId: input.inviterId,
    expiresAt: input.expiresAt,
    createdAt: new Date(),
  };
}
