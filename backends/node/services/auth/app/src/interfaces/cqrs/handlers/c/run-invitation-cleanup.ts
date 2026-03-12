import type { IHandler } from "@d2/handler";

export interface RunInvitationCleanupInput {}

export interface RunInvitationCleanupOutput {
  readonly rowsAffected: number;
  readonly lockAcquired: boolean;
  readonly durationMs: number;
}

/** Handler for cleaning up expired invitations (scheduled job). */
export interface IRunInvitationCleanupHandler
  extends IHandler<RunInvitationCleanupInput, RunInvitationCleanupOutput> {}
