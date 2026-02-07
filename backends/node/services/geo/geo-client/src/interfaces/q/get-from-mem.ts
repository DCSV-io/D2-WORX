import type { IHandler, RedactionSpec } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetFromMemInput
export interface GetFromMemInput {}

export interface GetFromMemOutput {
  data: GeoRefData;
}

/** Recommended redaction for GetFromMem handlers. */
export const GET_FROM_MEM_REDACTION: RedactionSpec = {
  suppressOutput: true, // Output contains GeoRefData (large, proto-generated)
};

/** Handler for getting georeference data from memory. Requires redaction. */
export interface IGetFromMemHandler extends IHandler<GetFromMemInput, GetFromMemOutput> {
  readonly redaction: RedactionSpec;
}
