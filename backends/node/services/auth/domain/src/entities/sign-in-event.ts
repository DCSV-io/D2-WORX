import { generateUuidV7 } from "@d2/utilities";
import { AuthValidationError } from "../exceptions/auth-validation-error.js";

export interface SignInEvent {
  readonly id: string;
  readonly userId: string;
  readonly successful: boolean;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly whoIsId: string | null;
  readonly failureReason: string | null;
  readonly createdAt: Date;
}

export interface CreateSignInEventInput {
  readonly userId: string;
  readonly successful: boolean;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly whoIsId?: string | null;
  readonly failureReason?: string | null;
  readonly id?: string;
}

export function createSignInEvent(input: CreateSignInEventInput): SignInEvent {
  if (!input.userId) {
    throw new AuthValidationError("SignInEvent", "userId", input.userId, "is required.");
  }

  if (!input.ipAddress) {
    throw new AuthValidationError("SignInEvent", "ipAddress", input.ipAddress, "is required.");
  }

  if (!input.userAgent) {
    throw new AuthValidationError("SignInEvent", "userAgent", input.userAgent, "is required.");
  }

  return {
    id: input.id ?? generateUuidV7(),
    userId: input.userId,
    successful: input.successful,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    whoIsId: input.whoIsId ?? null,
    failureReason: input.failureReason ?? null,
    createdAt: new Date(),
  };
}
