import type { IHandler } from "@d2/handler";

export interface CheckHealthInput {}

export interface ComponentHealth {
  status: string;
  latencyMs?: number;
  error?: string;
}

export interface CheckHealthOutput {
  status: string;
  components: Record<string, ComponentHealth>;
}

/** Handler for aggregating service health checks. */
export interface ICheckHealthHandler extends IHandler<CheckHealthInput, CheckHealthOutput> {}
