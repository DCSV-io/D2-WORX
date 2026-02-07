import type { IHandler } from "@d2/handler";

/** Input for checking if a key exists in the distributed cache. */
export interface ExistsInput {
  key: string;
}

/** Output for checking if a key exists in the distributed cache. */
export interface ExistsOutput {
  exists: boolean;
}

/** Handler for checking if a key exists in the distributed cache. */
export type IExistsHandler = IHandler<ExistsInput, ExistsOutput>;
