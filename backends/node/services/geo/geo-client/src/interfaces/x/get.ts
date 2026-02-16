import type { IHandler, RedactionSpec } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

export interface GetInput {}

export interface GetOutput {
  data: GeoRefData;
}

/** Recommended redaction for Get handlers. */
export const GET_REDACTION: RedactionSpec = {
  suppressOutput: true, // Output contains GeoRefData (large proto) or nested WhoIs data
};

/** Handler for getting georeference data. Requires redaction (output contains proto data). */
export interface IGetHandler extends IHandler<GetInput, GetOutput> {
  readonly redaction: RedactionSpec;
}
