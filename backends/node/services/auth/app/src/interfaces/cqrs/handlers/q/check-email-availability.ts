import type { IHandler, RedactionSpec } from "@d2/handler";

export interface CheckEmailAvailabilityInput {
  readonly email: string;
}

export interface CheckEmailAvailabilityOutput {
  readonly available: boolean;
}

/** Recommended redaction for CheckEmailAvailability handlers. */
export const CHECK_EMAIL_AVAILABILITY_REDACTION: RedactionSpec = {
  inputFields: ["email"],
};

/** Handler for checking email availability. Requires redaction (input contains PII). */
export interface ICheckEmailAvailabilityHandler
  extends IHandler<CheckEmailAvailabilityInput, CheckEmailAvailabilityOutput> {
  readonly redaction: RedactionSpec;
}
