import type { IHandler } from "@d2/handler";
import type { DeliveryRequest } from "@d2/comms-domain";

export interface CreateDeliveryRequestRecordInput {
  readonly request: DeliveryRequest;
}

export interface CreateDeliveryRequestRecordOutput {}

export type ICreateDeliveryRequestRecordHandler = IHandler<
  CreateDeliveryRequestRecordInput,
  CreateDeliveryRequestRecordOutput
>;
