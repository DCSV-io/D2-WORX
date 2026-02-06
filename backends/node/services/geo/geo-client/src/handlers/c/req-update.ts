import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { handleGrpcCall } from "@d2/result-extensions";
import type { GeoServiceClient, RequestReferenceDataUpdateResponse } from "@d2/protos";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET ReqUpdateInput
export interface ReqUpdateInput {}

export interface ReqUpdateOutput {
  version: string | undefined;
}

/**
 * Handler for requesting a reference data update from the Geo service via gRPC.
 * Mirrors D2.Geo.Client.CQRS.Handlers.C.ReqUpdate in .NET.
 */
export class ReqUpdate extends BaseHandler<ReqUpdateInput, ReqUpdateOutput> {
  private readonly geoClient: GeoServiceClient;

  constructor(geoClient: GeoServiceClient, context: IHandlerContext) {
    super(context);
    this.geoClient = geoClient;
  }

  protected async executeAsync(
    _input: ReqUpdateInput,
  ): Promise<D2Result<ReqUpdateOutput | undefined>> {
    const r = await handleGrpcCall(
      () =>
        new Promise<RequestReferenceDataUpdateResponse>((resolve, reject) => {
          this.geoClient.requestReferenceDataUpdate({}, (err, res) => {
            if (err) reject(err);
            else resolve(res);
          });
        }),
      (res) => res.result!,
      (res) => ({ version: res.data?.version }),
    );

    return D2Result.bubble(r, r.data);
  }
}
