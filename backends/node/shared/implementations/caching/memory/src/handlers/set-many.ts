import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { InMemoryCache } from "@d2/interfaces";
import type { MemoryCacheStore } from "../memory-cache-store.js";

export class SetMany<TValue> extends BaseHandler<
  InMemoryCache.SetManyInput<TValue>,
  InMemoryCache.SetManyOutput
> {
  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(
    input: InMemoryCache.SetManyInput<TValue>,
  ): Promise<D2Result<InMemoryCache.SetManyOutput | undefined>> {
    for (const [key, value] of Object.entries(input.values)) {
      this.store.set(key, value, input.expirationMs);
    }
    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
