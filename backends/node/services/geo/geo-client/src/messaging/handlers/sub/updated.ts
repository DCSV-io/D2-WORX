import { BaseHandler, type IHandlerContext, type IHandler } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import type { GeoRefDataUpdated } from "../../../messages/geo-ref-data-updated.js";
import type { Subs, Complex, Queries, Commands } from "../../../interfaces/index.js";

type Output = Subs.UpdatedOutput;

export interface UpdatedDeps {
  getHandler: IHandler<Record<string, never>, Complex.GetOutput>;
  getFromDist: IHandler<Record<string, never>, Queries.GetFromDistOutput>;
  setInMem: IHandler<{ data: GeoRefData }, Commands.SetInMemOutput>;
  setOnDisk: IHandler<{ data: GeoRefData }, Commands.SetOnDiskOutput>;
}

/**
 * Messaging subscription handler for geographic reference data updated notifications.
 * Mirrors D2.Geo.Client.Messaging.Handlers.Sub.Updated in .NET.
 */
export class Updated
  extends BaseHandler<GeoRefDataUpdated, Output>
  implements Subs.IUpdatedHandler
{
  private readonly deps: UpdatedDeps;

  constructor(deps: UpdatedDeps, context: IHandlerContext) {
    super(context);
    this.deps = deps;
  }

  protected async executeAsync(
    input: GeoRefDataUpdated,
  ): Promise<D2Result<Output | undefined>> {
    // Check if the current data is up to date
    const getR = await this.deps.getHandler.handleAsync({});
    const isUpToDate = getR.success && getR.data?.data.version === input.version;

    if (isUpToDate) {
      return D2Result.ok({ data: {}, traceId: this.traceId });
    }

    // Get the updated data from the distributed cache
    const distR = await this.deps.getFromDist.handleAsync({});
    if (distR.failed) {
      this.context.logger.error(
        `Failed to get data from dist cache after update message. TraceId: ${this.traceId}`,
      );
      return D2Result.notFound({ traceId: this.traceId });
    }

    const data = distR.data!.data;

    // Update in memory
    const setInMemR = await this.deps.setInMem.handleAsync({ data });
    if (setInMemR.failed) {
      this.context.logger.error(
        `Failed to set data in memory cache after update message. TraceId: ${this.traceId}`,
      );
    }

    // Update on disk
    const setOnDiskR = await this.deps.setOnDisk.handleAsync({ data });
    if (setOnDiskR.failed) {
      this.context.logger.error(
        `Failed to set data on disk after update message. TraceId: ${this.traceId}`,
      );
    }

    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}

export type { UpdatedOutput } from "../../../interfaces/sub/updated.js";
