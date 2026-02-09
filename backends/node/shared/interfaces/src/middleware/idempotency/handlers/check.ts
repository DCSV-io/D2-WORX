import type { IHandler } from "@d2/handler";
import type { IdempotencyState } from "../idempotency-state.js";
import type { CachedResponse } from "../cached-response.js";

/** Input for the idempotency check handler. */
export interface CheckInput {
  idempotencyKey: string;
}

/** Output from the idempotency check handler. */
export interface CheckOutput {
  state: IdempotencyState;
  cachedResponse: CachedResponse | undefined;
}

/** Handler for checking idempotency state (SET NX + GET). */
export type ICheckHandler = IHandler<CheckInput, CheckOutput>;
