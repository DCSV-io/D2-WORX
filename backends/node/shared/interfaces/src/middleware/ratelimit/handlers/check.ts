import type { IHandler, IRequestContext, RedactionSpec } from "@d2/handler";
import type { RateLimitDimension } from "../rate-limit-dimension.js";

/** Input for rate limit check handler. */
export interface CheckInput {
  requestContext: IRequestContext;
}

/** Output from rate limit check handler. */
export interface CheckOutput {
  isBlocked: boolean;
  blockedDimension: RateLimitDimension | undefined;
  retryAfterMs: number | undefined;
}

/** Recommended redaction for rate limit check handlers. */
export const CHECK_REDACTION: RedactionSpec = {
  suppressInput: true, // IRequestContext contains clientIp, fingerprint, userId, city
};

/** Handler for checking rate limits. Requires redaction (input contains PII). */
export interface ICheckHandler extends IHandler<CheckInput, CheckOutput> {
  readonly redaction: RedactionSpec;
}
