/** Possible states when checking an idempotency key. */
export type IdempotencyState = "acquired" | "in_flight" | "cached";
