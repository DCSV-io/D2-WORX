import { BaseHandler, type IHandlerContext } from "@d2/handler";
import { D2Result } from "@d2/result";
import { handleGrpcCall } from "@d2/result-extensions";
import type { GeoServiceClient, RequestReferenceDataUpdateResponse } from "@d2/protos";
import type { Commands } from "../../interfaces/index.js";

type Input = Commands.ReqUpdateInput;
type Output = Commands.ReqUpdateOutput;

/**
 * Handler for requesting a reference data update from the Geo service via gRPC.
 * Mirrors D2.Geo.Client.CQRS.Handlers.C.ReqUpdate in .NET.
 */
export class ReqUpdate
  extends BaseHandler<Input, Output>
  implements Commands.IReqUpdateHandler
{
  private readonly geoClient: GeoServiceClient;

  constructor(geoClient: GeoServiceClient, context: IHandlerContext) {
    super(context);
    this.geoClient = geoClient;
  }

  protected async executeAsync(_input: Input): Promise<D2Result<Output | undefined>> {
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

export type { ReqUpdateInput, ReqUpdateOutput } from "../../interfaces/c/req-update.js";
