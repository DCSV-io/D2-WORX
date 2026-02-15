import { generateUuidV7 } from "@d2/utilities";
import type { Role } from "../enums/role.js";
import { isValidRole } from "../enums/role.js";
import { AuthValidationError } from "../exceptions/auth-validation-error.js";

export interface Member {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly role: Role;
  readonly createdAt: Date;
}

export interface CreateMemberInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly role: Role;
  readonly id?: string;
}

export function createMember(input: CreateMemberInput): Member {
  if (!input.userId) {
    throw new AuthValidationError("Member", "userId", input.userId, "is required.");
  }

  if (!input.organizationId) {
    throw new AuthValidationError("Member", "organizationId", input.organizationId, "is required.");
  }

  if (!isValidRole(input.role)) {
    throw new AuthValidationError("Member", "role", input.role, "is not a valid role.");
  }

  return {
    id: input.id ?? generateUuidV7(),
    userId: input.userId,
    organizationId: input.organizationId,
    role: input.role,
    createdAt: new Date(),
  };
}
