import type { IHandler } from "@d2/handler";

export interface RunSessionPurgeInput {}

export interface RunSessionPurgeOutput {
  readonly rowsAffected: number;
  readonly lockAcquired: boolean;
  readonly durationMs: number;
}

/** Handler for purging expired sessions (scheduled job). */
export interface IRunSessionPurgeHandler
  extends IHandler<RunSessionPurgeInput, RunSessionPurgeOutput> {}
