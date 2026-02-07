import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { InMemoryCache } from "@d2/interfaces";
import type { MemoryCacheStore } from "../../memory-cache-store.js";

type Input = InMemoryCache.GetManyInput;

export class GetMany<TValue>
  extends BaseHandler<Input, InMemoryCache.GetManyOutput<TValue>>
  implements InMemoryCache.IGetManyHandler<TValue>
{
  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(
    input: Input,
  ): Promise<D2Result<InMemoryCache.GetManyOutput<TValue> | undefined>> {
    const found: Record<string, TValue> = {};
    let foundCount = 0;

    for (const key of input.keys) {
      const value = this.store.get<TValue>(key);
      if (value !== undefined) {
        found[key] = value;
        foundCount++;
      }
    }

    if (foundCount === 0) {
      return D2Result.notFound({ traceId: this.traceId });
    }

    if (foundCount < input.keys.length) {
      return D2Result.someFound({ data: { values: found }, traceId: this.traceId });
    }

    return D2Result.ok({ data: { values: found }, traceId: this.traceId });
  }
}
