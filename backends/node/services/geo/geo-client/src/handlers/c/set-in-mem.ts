import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { MemoryCacheStore } from "@d2/cache-memory";
import { Commands } from "../../interfaces/index.js";

type Input = Commands.SetInMemInput;
type Output = Commands.SetInMemOutput;

/**
 * Handler for setting georeference data in the in-memory cache.
 * Mirrors D2.Geo.Client.CQRS.Handlers.C.SetInMem in .NET.
 */
export class SetInMem extends BaseHandler<Input, Output> implements Commands.ISetInMemHandler {
  override get redaction() {
    return Commands.SET_IN_MEM_REDACTION;
  }

  private readonly store: MemoryCacheStore;

  constructor(store: MemoryCacheStore, context: IHandlerContext) {
    super(context);
    this.store = store;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    this.store.set("GeoRefData", input.data);
    return D2Result.ok({ data: {}, traceId: this.traceId });
  }
}

export type { SetInMemInput, SetInMemOutput } from "../../interfaces/c/set-in-mem.js";
