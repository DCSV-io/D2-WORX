import type { IHandler } from "@d2/handler";

export interface MarkDeliveryRequestProcessedInput {
  readonly id: string;
}

export interface MarkDeliveryRequestProcessedOutput {}

export type IMarkDeliveryRequestProcessedHandler = IHandler<
  MarkDeliveryRequestProcessedInput,
  MarkDeliveryRequestProcessedOutput
>;
