import type { IHandler } from "@d2/handler";

export interface PurgeDeliveryHistoryInput {
  readonly cutoffDate: Date;
}

export interface PurgeDeliveryHistoryOutput {
  readonly rowsAffected: number;
}

export type IPurgeDeliveryHistoryHandler = IHandler<
  PurgeDeliveryHistoryInput,
  PurgeDeliveryHistoryOutput
>;
