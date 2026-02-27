import type { IHandler } from "@d2/handler";
import type { DeliveryAttempt } from "@d2/comms-domain";

export interface CreateDeliveryAttemptRecordInput {
  readonly attempt: DeliveryAttempt;
}

export interface CreateDeliveryAttemptRecordOutput {}

export type ICreateDeliveryAttemptRecordHandler = IHandler<
  CreateDeliveryAttemptRecordInput,
  CreateDeliveryAttemptRecordOutput
>;
