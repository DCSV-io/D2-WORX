import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { InMemoryCache } from "@d2/interfaces";
import type { MemoryCacheStore } from "../../memory-cache-store.js";

type Input = InMemoryCache.RemoveInput;
type Output = InMemoryCache.RemoveOutput;

export class Remove extends BaseHandler<Input, Output> implements InMemoryCache.IRemoveHandler {
  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    this.store.delete(input.key);
    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}
