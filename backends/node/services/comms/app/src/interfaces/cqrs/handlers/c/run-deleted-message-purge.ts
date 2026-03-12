import type { IHandler } from "@d2/handler";

export interface RunDeletedMessagePurgeInput {}

export interface RunDeletedMessagePurgeOutput {
  readonly rowsAffected: number;
  readonly lockAcquired: boolean;
  readonly durationMs: number;
}

/** Handler for purging deleted messages (scheduled job). */
export interface IRunDeletedMessagePurgeHandler extends IHandler<
  RunDeletedMessagePurgeInput,
  RunDeletedMessagePurgeOutput
> {}
