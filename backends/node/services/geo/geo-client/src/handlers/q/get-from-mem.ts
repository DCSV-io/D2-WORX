import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import type { MemoryCacheStore } from "@d2/cache-memory";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetFromMemInput
export interface GetFromMemInput {}

export interface GetFromMemOutput {
  data: GeoRefData;
}

/**
 * Handler for getting georeference data from the in-memory cache.
 * Mirrors D2.Geo.Client.CQRS.Handlers.Q.GetFromMem in .NET.
 */
export class GetFromMem extends BaseHandler<GetFromMemInput, GetFromMemOutput> {
  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(
    _input: GetFromMemInput,
  ): Promise<D2Result<GetFromMemOutput | undefined>> {
    const value = this.store.get<GeoRefData>("GeoRefData");
    if (value === undefined) {
      return D2Result.notFound({ traceId: this.traceId });
    }
    return D2Result.ok({ data: { data: value }, traceId: this.traceId });
  }
}
