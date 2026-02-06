import type { IHandler } from "@d2/handler";

/** Input for getting a single value from the distributed cache. */
export interface GetInput {
  key: string;
}

/** Output for getting a single value from the distributed cache. Value is undefined if the key does not exist. */
export interface GetOutput<TValue> {
  value: TValue | undefined;
}

/** Handler for getting a single value from the distributed cache. */
export type IGetHandler<TValue> = IHandler<GetInput, GetOutput<TValue>>;
