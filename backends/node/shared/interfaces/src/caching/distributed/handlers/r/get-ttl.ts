import type { IHandler } from "@d2/handler";

/** Input for getting the remaining TTL of a cached key. */
export interface GetTtlInput {
  key: string;
}

/** Output for getting the remaining TTL of a cached key. Undefined if the key does not exist or has no expiration. */
export interface GetTtlOutput {
  timeToLiveMs: number | undefined;
}

/** Handler for getting the remaining TTL of a cached key. */
export type IGetTtlHandler = IHandler<GetTtlInput, GetTtlOutput>;
