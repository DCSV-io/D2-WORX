import type { IHandler } from "@d2/handler";

/** Input for pinging the auth database. */
export interface PingDbInput {}

/** Output for pinging the auth database. */
export interface PingDbOutput {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/** Handler for pinging the auth database to verify connectivity. */
export type IPingDbHandler = IHandler<PingDbInput, PingDbOutput>;
