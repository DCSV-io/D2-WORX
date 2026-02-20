import type { IHandler } from "@d2/handler";
import type { DeliveryAttempt } from "@d2/comms-domain";

export interface FindDeliveryAttemptsByRequestIdInput {
  readonly requestId: string;
}

export interface FindDeliveryAttemptsByRequestIdOutput {
  readonly attempts: DeliveryAttempt[];
}

export type IFindDeliveryAttemptsByRequestIdHandler = IHandler<
  FindDeliveryAttemptsByRequestIdInput,
  FindDeliveryAttemptsByRequestIdOutput
>;
