import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { Queries } from "../../../../interfaces/cqrs/handlers/index.js";
import { D2Result } from "@d2/result";
import type { IPingDbHandler } from "../../../../interfaces/repository/handlers/index.js";
import type { FileStorageHandlers } from "../../../../interfaces/providers/storage/handlers/index.js";

type Input = Queries.CheckHealthInput;
type Output = Queries.CheckHealthOutput;

/**
 * Aggregates ping results from all files service dependencies into a single
 * health check response.
 */
export class CheckHealth extends BaseHandler<Input, Output> implements Queries.ICheckHealthHandler {
  private readonly pingDb: IPingDbHandler;
  private readonly storage: FileStorageHandlers;

  constructor(pingDb: IPingDbHandler, storage: FileStorageHandlers, context: IHandlerContext) {
    super(context);
    this.pingDb = pingDb;
    this.storage = storage;
  }

  protected async executeAsync(_input: Input): Promise<D2Result<Output | undefined>> {
    const components: Record<string, Queries.ComponentHealth> = {};

    const [dbResult, storageResult] = await Promise.all([
      this.pingDb.handleAsync({}),
      this.storage.ping.handleAsync({}),
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

    // Object storage (MinIO)
    if (storageResult.data) {
      components["storage"] = {
        status: storageResult.data.healthy ? "healthy" : "unhealthy",
        latencyMs: storageResult.data.latencyMs,
        error: storageResult.data.error,
      };
    } else {
      components["storage"] = { status: "unhealthy", error: "Ping handler returned no data" };
    }

    const allHealthy = Object.values(components).every((c) => c.status === "healthy");
    const status = allHealthy ? "healthy" : "degraded";

    return D2Result.ok({ data: { status, components } });
  }
}
