import type { IHandler } from "@d2/handler";

/** Input for pinging the message bus. */
export interface PingInput {}

/** Output for pinging the message bus. */
export interface PingOutput {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/** Handler for pinging the message bus to verify connectivity. */
export type IPingHandler = IHandler<PingInput, PingOutput>;
