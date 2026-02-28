import type { IHandler } from "@d2/handler";

export interface PurgeSignInEventsInput {
  readonly cutoffDate: Date;
}

export interface PurgeSignInEventsOutput {
  readonly rowsAffected: number;
}

export type IPurgeSignInEventsHandler = IHandler<PurgeSignInEventsInput, PurgeSignInEventsOutput>;
