import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import type { DistributedCache } from "@d2/interfaces";
import { DIST_CACHE_KEY_GEO_REF_DATA } from "@d2/utilities";
import { Queries } from "../../interfaces/index.js";

type Input = Queries.GetFromDistInput;
type Output = Queries.GetFromDistOutput;

/**
 * Handler for getting georeference data from the distributed (Redis) cache.
 * Mirrors D2.Geo.Client.CQRS.Handlers.Q.GetFromDist in .NET.
 */
export class GetFromDist extends BaseHandler<Input, Output> implements Queries.IGetFromDistHandler {
  override get redaction() {
    return Queries.GET_FROM_DIST_REDACTION;
  }

  private readonly distCacheGet: DistributedCache.IGetHandler<GeoRefData>;

  constructor(distCacheGet: DistributedCache.IGetHandler<GeoRefData>, context: IHandlerContext) {
    super(context);
    this.distCacheGet = distCacheGet;
  }

  protected async executeAsync(_input: Input): Promise<D2Result<Output | undefined>> {
    const getR = await this.distCacheGet.handleAsync({
      key: DIST_CACHE_KEY_GEO_REF_DATA,
    });

    const value = getR.checkSuccess();
    if (value?.value !== undefined) {
      return D2Result.ok({ data: { data: value.value } });
    }
    return D2Result.notFound();
  }
}

export type { GetFromDistInput, GetFromDistOutput } from "../../interfaces/q/get-from-dist.js";
