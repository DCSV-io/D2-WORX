import type { IHandler } from "@d2/handler";

export interface PurgeExpiredInvitationsInput {
  readonly cutoffDate: Date;
}

export interface PurgeExpiredInvitationsOutput {
  readonly rowsAffected: number;
}

export type IPurgeExpiredInvitationsHandler = IHandler<
  PurgeExpiredInvitationsInput,
  PurgeExpiredInvitationsOutput
>;
