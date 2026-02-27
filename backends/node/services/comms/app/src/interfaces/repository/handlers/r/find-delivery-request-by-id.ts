import type { IHandler } from "@d2/handler";
import type { DeliveryRequest } from "@d2/comms-domain";

export interface FindDeliveryRequestByIdInput {
  readonly id: string;
}

export interface FindDeliveryRequestByIdOutput {
  readonly request: DeliveryRequest;
}

export type IFindDeliveryRequestByIdHandler = IHandler<
  FindDeliveryRequestByIdInput,
  FindDeliveryRequestByIdOutput
>;
