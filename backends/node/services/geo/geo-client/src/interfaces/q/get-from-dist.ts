import type { IHandler, RedactionSpec } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

export interface GetFromDistInput {}

export interface GetFromDistOutput {
  data: GeoRefData;
}

/** Recommended redaction for GetFromDist handlers. */
export const GET_FROM_DIST_REDACTION: RedactionSpec = {
  suppressOutput: true, // Output contains GeoRefData (large, proto-generated)
};

/** Handler for getting georeference data from distributed cache. Requires redaction. */
export interface IGetFromDistHandler extends IHandler<GetFromDistInput, GetFromDistOutput> {
  readonly redaction: RedactionSpec;
}
