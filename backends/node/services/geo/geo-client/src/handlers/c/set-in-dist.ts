import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import { GeoRefData as GeoRefDataCodec } from "@d2/protos";
import type { DistributedCache } from "@d2/interfaces";
import { DIST_CACHE_KEY_GEO_REF_DATA } from "@d2/utilities";
import type { ICacheSerializer } from "@d2/cache-redis";
import type { Commands } from "../../interfaces/index.js";

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
export class SetInDist
  extends BaseHandler<Input, Output>
  implements Commands.ISetInDistHandler
{
  private readonly distCacheSet: DistributedCache.ISetHandler<GeoRefData>;

  constructor(distCacheSet: DistributedCache.ISetHandler<GeoRefData>, context: IHandlerContext) {
    super(context);
    this.distCacheSet = distCacheSet;
  }

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    const setR = await this.distCacheSet.handleAsync({
      key: DIST_CACHE_KEY_GEO_REF_DATA,
      value: input.data,
    });

    if (setR.success) {
      return D2Result.ok({ data: {}, traceId: this.traceId });
    }
    return D2Result.bubbleFail(setR);
  }
}

export type { SetInDistInput, SetInDistOutput } from "../../interfaces/c/set-in-dist.js";
