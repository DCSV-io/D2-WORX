import type { IHandler } from "@d2/handler";

/** Input for getting a single value from the in-memory cache. */
export interface GetInput {
  key: string;
}

/** Output for getting a single value from the in-memory cache. */
export interface GetOutput<TValue> {
  value: TValue;
}

/** Handler for getting a single value from the in-memory cache. */
export type IGetHandler<TValue> = IHandler<GetInput, GetOutput<TValue>>;
