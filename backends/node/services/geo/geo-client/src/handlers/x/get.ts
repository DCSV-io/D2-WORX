import { BaseHandler, type IHandlerContext, type IHandler } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import type { GetFromMemOutput } from "../q/get-from-mem.js";
import type { GetFromDistOutput } from "../q/get-from-dist.js";
import type { GetFromDiskOutput } from "../q/get-from-disk.js";
import type { ReqUpdateOutput } from "../c/req-update.js";
import type { SetInMemOutput } from "../c/set-in-mem.js";
import type { SetOnDiskOutput } from "../c/set-on-disk.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetInput
export interface GetInput {}

export interface GetOutput {
  data: GeoRefData;
}

export interface GetDeps {
  getFromMem: IHandler<Record<string, never>, GetFromMemOutput>;
  getFromDist: IHandler<Record<string, never>, GetFromDistOutput>;
  getFromDisk: IHandler<Record<string, never>, GetFromDiskOutput>;
  reqUpdate: IHandler<Record<string, never>, ReqUpdateOutput>;
  setInMem: IHandler<{ data: GeoRefData }, SetInMemOutput>;
  setOnDisk: IHandler<{ data: GeoRefData }, SetOnDiskOutput>;
}

/**
 * Multi-tier orchestrator for getting georeference data.
 * Tries: Memory -> Redis -> RequestUpdate + Disk, with 6-attempt exponential backoff.
 *
 * Mirrors D2.Geo.Client.CQRS.Handlers.X.Get in .NET.
 */
export class Get extends BaseHandler<GetInput, GetOutput> {
  private readonly deps: GetDeps;

  constructor(deps: GetDeps, context: IHandlerContext) {
    super(context);
    this.deps = deps;
  }

  protected async executeAsync(_input: GetInput): Promise<D2Result<GetOutput | undefined>> {
    const maxAttempts = 6;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.getAttempt();
      if (result.success) {
        return result;
      }

      // Delay before next attempt (except after last attempt)
      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return D2Result.notFound({ traceId: this.traceId });
  }

  private async getAttempt(): Promise<D2Result<GetOutput | undefined>> {
    // 1. Try in-memory cache
    const memR = await this.deps.getFromMem.handleAsync({});
    const memData = memR.checkSuccess();
    if (memData) {
      return D2Result.ok({ data: { data: memData.data }, traceId: this.traceId });
    }

    // 2. Try distributed cache
    const distR = await this.deps.getFromDist.handleAsync({});
    const distData = distR.checkSuccess();
    if (distData) {
      await this.setInMemoryAndOnDisk(distData.data);
      return D2Result.ok({ data: { data: distData.data }, traceId: this.traceId });
    }

    // 3. Tell Geo service to update the distributed cache
    const updateR = await this.deps.reqUpdate.handleAsync({});
    if (updateR.failed) {
      this.context.logger.error(
        `Failed to request update of georeference data (consumer). TraceId: ${this.traceId}`,
      );
    }

    // 4. Try disk
    const diskR = await this.deps.getFromDisk.handleAsync({});
    const diskData = diskR.checkSuccess();
    if (diskData) {
      const setMemR = await this.deps.setInMem.handleAsync({ data: diskData.data });
      if (setMemR.failed) {
        this.context.logger.error(
          `Failed to set data in memory cache (consumer). TraceId: ${this.traceId}`,
        );
      }
      return D2Result.ok({ data: { data: diskData.data }, traceId: this.traceId });
    }

    // All sources failed for this attempt
    return D2Result.notFound({ traceId: this.traceId });
  }

  private async setInMemoryAndOnDisk(data: GeoRefData): Promise<void> {
    const setMemR = await this.deps.setInMem.handleAsync({ data });
    if (setMemR.failed) {
      this.context.logger.error(
        `Failed to set data in memory cache (consumer). TraceId: ${this.traceId}`,
      );
    }

    const setDiskR = await this.deps.setOnDisk.handleAsync({ data });
    if (setDiskR.failed) {
      this.context.logger.error(`Failed to set data on disk (consumer). TraceId: ${this.traceId}`);
    }
  }
}
