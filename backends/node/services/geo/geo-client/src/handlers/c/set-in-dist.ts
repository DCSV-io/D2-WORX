import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import { GeoRefData as GeoRefDataCodec } from "@d2/protos";
import type { DistributedCache } from "@d2/interfaces";
import type { ICacheSerializer } from "@d2/cache-redis";
import { GEO_CACHE_KEYS } from "../../cache-keys.js";
import { Commands } from "../../interfaces/index.js";

type Input = Commands.SetInDistInput;
type Output = Commands.SetInDistOutput;

/** Protobuf serializer for GeoRefData (binary, not JSON). */
export class GeoRefDataSerializer implements ICacheSerializer<GeoRefData> {
  serialize(value: GeoRefData): Buffer {
    return Buffer.from(GeoRefDataCodec.encode(value).finish());
  }

  deserialize(raw: Buffer): GeoRefData {
    return GeoRefDataCodec.decode(raw);
  }
}

/**
 * Handler for setting georeference data in the distributed (Redis) cache.
 * Mirrors D2.Geo.Client.CQRS.Handlers.C.SetInDist in .NET.
 */
export class SetInDist extends BaseHandler<Input, Output> implements Commands.ISetInDistHandler {
  override get redaction() {
    return Commands.SET_IN_DIST_REDACTION;
  }

  private readonly distCacheSet: DistributedCache.ISetHandler<GeoRefData>;

  constructor(distCacheSet: DistributedCache.ISetHandler<GeoRefData>, context: IHandlerContext) {
    super(context);
    this.distCacheSet = distCacheSet;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const setR = await this.distCacheSet.handleAsync({
      key: GEO_CACHE_KEYS.REFDATA,
      value: input.data,
    });

    if (setR.success) {
      return D2Result.ok({ data: {} });
    }
    return D2Result.bubbleFail(setR);
  }
}

export type { SetInDistInput, SetInDistOutput } from "../../interfaces/c/set-in-dist.js";
