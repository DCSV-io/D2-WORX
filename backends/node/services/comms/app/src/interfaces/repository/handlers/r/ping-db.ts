import type { IHandler } from "@d2/handler";

/** Input for pinging the comms database. */
export interface PingDbInput {}

/** Output for pinging the comms database. */
export interface PingDbOutput {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/** Handler for pinging the comms database to verify connectivity. */
export type IPingDbHandler = IHandler<PingDbInput, PingDbOutput>;
