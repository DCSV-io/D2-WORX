import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import type { MemoryCacheStore } from "@d2/cache-memory";
import type { Queries } from "../../interfaces/index.js";

type Input = Queries.GetFromMemInput;
type Output = Queries.GetFromMemOutput;

/**
 * Handler for getting georeference data from the in-memory cache.
 * Mirrors D2.Geo.Client.CQRS.Handlers.Q.GetFromMem in .NET.
 */
export class GetFromMem extends BaseHandler<Input, Output> implements Queries.IGetFromMemHandler {
  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(_input: Input): Promise<D2Result<Output | undefined>> {
    const value = this.store.get<GeoRefData>("GeoRefData");
    if (value === undefined) {
      return D2Result.notFound({ traceId: this.traceId });
    }
    return D2Result.ok({ data: { data: value }, traceId: this.traceId });
  }
}

export type { GetFromMemInput, GetFromMemOutput } from "../../interfaces/q/get-from-mem.js";
