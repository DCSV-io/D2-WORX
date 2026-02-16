import { BaseHandler, type IHandlerContext, type IHandler } from "@d2/handler";
import { D2Result, retryResultAsync } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import { Complex, type Queries, type Commands } from "../../interfaces/index.js";

type Input = Complex.GetInput;
type Output = Complex.GetOutput;

export interface GetDeps {
  getFromMem: IHandler<Record<string, never>, Queries.GetFromMemOutput>;
  getFromDist: IHandler<Record<string, never>, Queries.GetFromDistOutput>;
  getFromDisk: IHandler<Record<string, never>, Queries.GetFromDiskOutput>;
  reqUpdate: IHandler<Record<string, never>, Commands.ReqUpdateOutput>;
  setInMem: IHandler<{ data: GeoRefData }, Commands.SetInMemOutput>;
  setOnDisk: IHandler<{ data: GeoRefData }, Commands.SetOnDiskOutput>;
}

/**
 * Multi-tier orchestrator for getting georeference data.
 * Tries: Memory -> Redis -> RequestUpdate + Disk, with 6-attempt exponential backoff.
 *
 * Mirrors D2.Geo.Client.CQRS.Handlers.X.Get in .NET.
 */
export class Get extends BaseHandler<Input, Output> implements Complex.IGetHandler {
  override get redaction() {
    return Complex.GET_REDACTION;
  }

  private readonly deps: GetDeps;

  constructor(deps: GetDeps, context: IHandlerContext) {
    super(context);
    this.deps = deps;
  }

  protected async executeAsync(_input: Input): Promise<D2Result<Output | undefined>> {
    // 6 attempts with exponential backoff (1s, 2s, 4s, 8s, 16s). Total: ~31 seconds.
    // Retry any non-success (i.e. NotFound = data not available yet, try again).
    return retryResultAsync(() => this.getAttempt(), {
      maxAttempts: 6,
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      jitter: false,
      isTransientResult: (r) => !r.success,
    });
  }

  private async getAttempt(): Promise<D2Result<Output | undefined>> {
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

export type { GetInput, GetOutput } from "../../interfaces/x/get.js";
