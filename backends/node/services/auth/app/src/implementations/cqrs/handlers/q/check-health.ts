import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { DistributedCache, Messaging } from "@d2/interfaces";
import type { IPingDbHandler } from "../../../../interfaces/repository/handlers/index.js";

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

/**
 * Aggregates ping results from all auth service dependencies into a single
 * health check response. Each dependency check is a BaseHandler with its own
 * OTel span.
 */
export class CheckHealth extends BaseHandler<CheckHealthInput, CheckHealthOutput> {
  private readonly pingDb: IPingDbHandler;
  private readonly pingCache: DistributedCache.IPingHandler;
  private readonly pingMessageBus?: Messaging.IPingHandler;

  constructor(
    pingDb: IPingDbHandler,
    pingCache: DistributedCache.IPingHandler,
    context: IHandlerContext,
    pingMessageBus?: Messaging.IPingHandler,
  ) {
    super(context);
    this.pingDb = pingDb;
    this.pingCache = pingCache;
    this.pingMessageBus = pingMessageBus;
  }

  protected async executeAsync(
    _input: CheckHealthInput,
  ): Promise<D2Result<CheckHealthOutput | undefined>> {
    const components: Record<string, ComponentHealth> = {};

    // Fan out all pings in parallel
    const [dbResult, cacheResult, messageBusResult] = await Promise.all([
      this.pingDb.handleAsync({}),
      this.pingCache.handleAsync({}),
      this.pingMessageBus?.handleAsync({}) ?? Promise.resolve(undefined),
    ]);

    // DB
    if (dbResult.data) {
      components["db"] = {
        status: dbResult.data.healthy ? "healthy" : "unhealthy",
        latencyMs: dbResult.data.latencyMs,
        error: dbResult.data.error,
      };
    } else {
      components["db"] = { status: "unhealthy", error: "Ping handler returned no data" };
    }

    // Cache
    if (cacheResult.data) {
      components["cache"] = {
        status: cacheResult.data.healthy ? "healthy" : "unhealthy",
        latencyMs: cacheResult.data.latencyMs,
        error: cacheResult.data.error,
      };
    } else {
      components["cache"] = { status: "unhealthy", error: "Ping handler returned no data" };
    }

    // Messaging
    if (messageBusResult === undefined) {
      components["messaging"] = { status: "not configured" };
    } else if (messageBusResult.data) {
      components["messaging"] = {
        status: messageBusResult.data.healthy ? "healthy" : "unhealthy",
        latencyMs: messageBusResult.data.latencyMs,
        error: messageBusResult.data.error,
      };
    } else {
      components["messaging"] = { status: "unhealthy", error: "Ping handler returned no data" };
    }

    const allHealthy = Object.values(components).every(
      (c) => c.status === "healthy" || c.status === "not configured",
    );
    const status = allHealthy ? "healthy" : "degraded";

    return D2Result.ok({ data: { status, components } });
  }
}
