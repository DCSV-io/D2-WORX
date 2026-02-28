import type { IHandler } from "@d2/handler";

export interface PurgeDeletedMessagesInput {
  readonly cutoffDate: Date;
}

export interface PurgeDeletedMessagesOutput {
  readonly rowsAffected: number;
}

export type IPurgeDeletedMessagesHandler = IHandler<
  PurgeDeletedMessagesInput,
  PurgeDeletedMessagesOutput
>;
