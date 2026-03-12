import type { IHandler } from "@d2/handler";

export interface RunSignInEventPurgeInput {}

export interface RunSignInEventPurgeOutput {
  readonly rowsAffected: number;
  readonly lockAcquired: boolean;
  readonly durationMs: number;
}

/** Handler for purging old sign-in events (scheduled job). */
export interface IRunSignInEventPurgeHandler extends IHandler<
  RunSignInEventPurgeInput,
  RunSignInEventPurgeOutput
> {}
