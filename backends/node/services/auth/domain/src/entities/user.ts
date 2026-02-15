import { cleanStr, cleanAndValidateEmail, generateUuidV7 } from "@d2/utilities";
import { AuthValidationError } from "../exceptions/auth-validation-error.js";

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly image: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly id?: string;
  readonly image?: string | null;
  readonly emailVerified?: boolean;
}

export interface UpdateUserInput {
  readonly name?: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly image?: string | null;
}

export function createUser(input: CreateUserInput): User {
  const email = cleanAndValidateEmail(input.email);

  const name = cleanStr(input.name);
  if (!name) {
    throw new AuthValidationError("User", "name", input.name, "is required.");
  }

  return {
    id: input.id ?? generateUuidV7(),
    email,
    name,
    emailVerified: input.emailVerified ?? false,
    image: input.image ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function updateUser(user: User, updates: UpdateUserInput): User {
  let email = user.email;
  if (updates.email !== undefined) {
    email = cleanAndValidateEmail(updates.email);
  }

  let name = user.name;
  if (updates.name !== undefined) {
    const cleaned = cleanStr(updates.name);
    if (!cleaned) {
      throw new AuthValidationError("User", "name", updates.name, "is required.");
    }
    name = cleaned;
  }

  return {
    ...user,
    email,
    name,
    emailVerified: updates.emailVerified ?? user.emailVerified,
    image: updates.image !== undefined ? updates.image : user.image,
    updatedAt: new Date(),
  };
}
