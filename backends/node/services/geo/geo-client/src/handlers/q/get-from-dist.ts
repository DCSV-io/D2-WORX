import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { GeoRefData } from "@d2/protos";
import type { DistributedCache } from "@d2/interfaces";
import { DIST_CACHE_KEY_GEO_REF_DATA } from "@d2/utilities";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetFromDistInput
export interface GetFromDistInput {}

export interface GetFromDistOutput {
  data: GeoRefData;
}

/**
 * Handler for getting georeference data from the distributed (Redis) cache.
 * Mirrors D2.Geo.Client.CQRS.Handlers.Q.GetFromDist in .NET.
 */
export class GetFromDist extends BaseHandler<GetFromDistInput, GetFromDistOutput> {
  private readonly distCacheGet: DistributedCache.IGetHandler<GeoRefData>;

  constructor(distCacheGet: DistributedCache.IGetHandler<GeoRefData>, context: IHandlerContext) {
    super(context);
    this.distCacheGet = distCacheGet;
  }

  protected async executeAsync(
    _input: GetFromDistInput,
  ): Promise<D2Result<GetFromDistOutput | undefined>> {
    const getR = await this.distCacheGet.handleAsync({
      key: DIST_CACHE_KEY_GEO_REF_DATA,
    });

    const value = getR.checkSuccess();
    if (value?.value !== undefined) {
      return D2Result.ok({ data: { data: value.value }, traceId: this.traceId });
    }
    return D2Result.notFound({ traceId: this.traceId });
  }
}
