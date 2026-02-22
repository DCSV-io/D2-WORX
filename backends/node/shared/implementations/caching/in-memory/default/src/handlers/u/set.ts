import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { InMemoryCache } from "@d2/interfaces";
import type { MemoryCacheStore } from "../../memory-cache-store.js";

export class Set<TValue>
  extends BaseHandler<InMemoryCache.SetInput<TValue>, InMemoryCache.SetOutput>
  implements InMemoryCache.ISetHandler<TValue>
{
  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(
    input: InMemoryCache.SetInput<TValue>,
  ): Promise<D2Result<InMemoryCache.SetOutput | undefined>> {
    this.store.set(input.key, input.value, input.expirationMs);
    return D2Result.ok({ data: {} });
  }
}
