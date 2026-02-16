import type { IHandler } from "@d2/handler";

/** Input for setting multiple values in the in-memory cache. */
export interface SetManyInput<TValue> {
  values: Record<string, TValue>;
  expirationMs?: number;
}

/** Output for setting multiple values in the in-memory cache. */

export interface SetManyOutput {}

/** Handler for setting multiple values in the in-memory cache. */
export type ISetManyHandler<TValue> = IHandler<SetManyInput<TValue>, SetManyOutput>;
