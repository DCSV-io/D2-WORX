import type { IHandler } from "@d2/handler";
import type { DeliveryStatus } from "@d2/comms-domain";

export interface UpdateDeliveryAttemptStatusInput {
  readonly id: string;
  readonly status: DeliveryStatus;
  readonly providerMessageId?: string;
  readonly error?: string;
  readonly nextRetryAt?: Date | null;
}

export interface UpdateDeliveryAttemptStatusOutput {}

export type IUpdateDeliveryAttemptStatusHandler = IHandler<
  UpdateDeliveryAttemptStatusInput,
  UpdateDeliveryAttemptStatusOutput
>;
