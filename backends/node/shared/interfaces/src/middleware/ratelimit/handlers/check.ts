import type { IHandler, RedactionSpec } from "@d2/handler";
import type { IRequestInfo } from "../../request-enrichment/i-request-info.js";
import type { RateLimitDimension } from "../rate-limit-dimension.js";

/** Input for rate limit check handler. */
export interface CheckInput {
  requestInfo: IRequestInfo;
}

/** Output from rate limit check handler. */
export interface CheckOutput {
  isBlocked: boolean;
  blockedDimension: RateLimitDimension | undefined;
  retryAfterMs: number | undefined;
}

/** Recommended redaction for rate limit check handlers. */
export const CHECK_REDACTION: RedactionSpec = {
  suppressInput: true, // IRequestInfo contains clientIp, fingerprint, userId, city
};

/** Handler for checking rate limits. Requires redaction (input contains PII). */
export interface ICheckHandler extends IHandler<CheckInput, CheckOutput> {
  readonly redaction: RedactionSpec;
}
