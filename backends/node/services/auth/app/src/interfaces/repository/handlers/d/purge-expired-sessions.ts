import type { IHandler } from "@d2/handler";

export interface PurgeExpiredSessionsInput extends Record<string, never> {}

export interface PurgeExpiredSessionsOutput {
  readonly rowsAffected: number;
}

export type IPurgeExpiredSessionsHandler = IHandler<
  PurgeExpiredSessionsInput,
  PurgeExpiredSessionsOutput
>;
