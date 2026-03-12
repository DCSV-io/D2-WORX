import type { IHandler, RedactionSpec } from "@d2/handler";
import type { SignInEvent } from "@d2/auth-domain";

export interface GetSignInEventsInput {
  readonly userId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetSignInEventsOutput {
  events: SignInEvent[];
  total: number;
}

/** Recommended redaction for GetSignInEvents handlers. */
export const GET_SIGN_IN_EVENTS_REDACTION: RedactionSpec = {
  suppressOutput: true,
};

/** Handler for retrieving paginated sign-in events. Requires redaction (output contains PII). */
export interface IGetSignInEventsHandler
  extends IHandler<GetSignInEventsInput, GetSignInEventsOutput> {
  readonly redaction: RedactionSpec;
}
