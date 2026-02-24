import type { IHandler } from "@d2/handler";

/** Input for pinging the distributed cache. */
export interface PingInput {}

/** Output for pinging the distributed cache. */
export interface PingOutput {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/** Handler for pinging the distributed cache to verify connectivity. */
export type IPingHandler = IHandler<PingInput, PingOutput>;
