import type { IRequestInfo } from "@d2/request-enrichment";
import type { RateLimitDimension } from "./rate-limit-dimension.js";

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
