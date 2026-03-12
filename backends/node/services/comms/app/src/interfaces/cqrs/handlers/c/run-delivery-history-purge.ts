import type { IHandler } from "@d2/handler";

export interface RunDeliveryHistoryPurgeInput {}

export interface RunDeliveryHistoryPurgeOutput {
  readonly rowsAffected: number;
  readonly lockAcquired: boolean;
  readonly durationMs: number;
}

/** Handler for purging old delivery history (scheduled job). */
export interface IRunDeliveryHistoryPurgeHandler extends IHandler<
  RunDeliveryHistoryPurgeInput,
  RunDeliveryHistoryPurgeOutput
> {}
