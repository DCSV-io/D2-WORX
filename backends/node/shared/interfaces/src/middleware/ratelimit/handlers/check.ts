import type { IHandler } from "@d2/handler";
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

/** Handler for checking rate limits. */
export type ICheckHandler = IHandler<CheckInput, CheckOutput>;
