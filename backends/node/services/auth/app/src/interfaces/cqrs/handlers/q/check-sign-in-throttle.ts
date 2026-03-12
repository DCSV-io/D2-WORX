import type { IHandler } from "@d2/handler";

export interface CheckSignInThrottleInput {
  readonly identifierHash: string;
  readonly identityHash: string;
}

export interface CheckSignInThrottleOutput {
  readonly blocked: boolean;
  readonly retryAfterSec?: number;
}

/** Handler for checking sign-in throttle status. */
export interface ICheckSignInThrottleHandler
  extends IHandler<CheckSignInThrottleInput, CheckSignInThrottleOutput> {}
