import type { IHandler } from "@d2/handler";
import type { SignInEvent } from "@d2/auth-domain";

export interface FindSignInEventsByUserIdInput {
  readonly userId: string;
  readonly limit: number;
  readonly offset: number;
}

export interface FindSignInEventsByUserIdOutput {
  readonly events: SignInEvent[];
}

export type IFindSignInEventsByUserIdHandler =
  IHandler<FindSignInEventsByUserIdInput, FindSignInEventsByUserIdOutput>;
