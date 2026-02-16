import type { IHandler } from "@d2/handler";
import type { SignInEvent } from "@d2/auth-domain";

export interface CreateSignInEventInput {
  readonly event: SignInEvent;
}

export interface CreateSignInEventOutput {}

export type ICreateSignInEventHandler = IHandler<CreateSignInEventInput, CreateSignInEventOutput>;
