import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import type { MemoryCacheStore } from "@d2/cache-memory";

export interface SetInMemInput {
  data: GeoRefData;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetInMemOutput {}

/**
 * Handler for setting georeference data in the in-memory cache.
 * Mirrors D2.Geo.Client.CQRS.Handlers.C.SetInMem in .NET.
 */
export class SetInMem extends BaseHandler<SetInMemInput, SetInMemOutput> {
  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(
    input: SetInMemInput,
  ): Promise<D2Result<SetInMemOutput | undefined>> {
    this.store.set("GeoRefData", input.data);
    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
