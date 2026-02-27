import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { InMemoryCache } from "@d2/interfaces";
import type { MemoryCacheStore } from "../../memory-cache-store.js";

type Input = InMemoryCache.GetInput;

export class Get<TValue>
  extends BaseHandler<Input, InMemoryCache.GetOutput<TValue>>
  implements InMemoryCache.IGetHandler<TValue>
{
  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(
    input: Input,
  ): Promise<D2Result<InMemoryCache.GetOutput<TValue> | undefined>> {
    const value = this.store.get<TValue>(input.key);
    if (value === undefined) {
      return D2Result.notFound();
    }
    return D2Result.ok({ data: { value } });
  }
}
