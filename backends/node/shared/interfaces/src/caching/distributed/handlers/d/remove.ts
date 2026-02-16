import type { IHandler } from "@d2/handler";

/** Input for removing a single key from the distributed cache. */
export interface RemoveInput {
  key: string;
}

/** Output for removing a single key from the distributed cache. */

export interface RemoveOutput {}

/** Handler for removing a single key from the distributed cache. */
export type IRemoveHandler = IHandler<RemoveInput, RemoveOutput>;
