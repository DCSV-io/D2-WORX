import type { IHandler } from "@d2/handler";

export interface CheckEmailAvailabilityInput {
  readonly email: string;
}

export interface CheckEmailAvailabilityOutput {
  readonly available: boolean;
}

export type ICheckEmailAvailabilityHandler = IHandler<
  CheckEmailAvailabilityInput,
  CheckEmailAvailabilityOutput
>;
