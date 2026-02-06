import type { IHandler } from "@d2/handler";

/** Input for atomically incrementing a counter in the distributed cache. */
export interface IncrementInput {
  key: string;
  amount?: number;
  expirationMs?: number;
}

/** Output for atomically incrementing a counter in the distributed cache. */
export interface IncrementOutput {
  newValue: number;
}

/** Handler for atomically incrementing a counter in the distributed cache. */
export type IIncrementHandler = IHandler<IncrementInput, IncrementOutput>;
