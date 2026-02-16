import type { IHandler } from "@d2/handler";

/** Input for setting a single value in the distributed cache. */
export interface SetInput<TValue> {
  key: string;
  value: TValue;
  expirationMs?: number;
}

/** Output for setting a single value in the distributed cache. */

export interface SetOutput {}

/** Handler for setting a single value in the distributed cache. */
export type ISetHandler<TValue> = IHandler<SetInput<TValue>, SetOutput>;
