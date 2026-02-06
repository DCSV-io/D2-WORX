import type { IHandler } from "@d2/handler";

/** Input for getting multiple values from the in-memory cache. */
export interface GetManyInput {
  keys: string[];
}

/** Output for getting multiple values from the in-memory cache. */
export interface GetManyOutput<TValue> {
  values: Record<string, TValue>;
}

/** Handler for getting multiple values from the in-memory cache. */
export type IGetManyHandler<TValue> = IHandler<GetManyInput, GetManyOutput<TValue>>;
