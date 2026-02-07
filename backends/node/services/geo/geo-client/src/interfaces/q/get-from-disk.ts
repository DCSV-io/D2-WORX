import type { IHandler, RedactionSpec } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetFromDiskInput
export interface GetFromDiskInput {}

export interface GetFromDiskOutput {
  data: GeoRefData;
}

/** Recommended redaction for GetFromDisk handlers. */
export const GET_FROM_DISK_REDACTION: RedactionSpec = {
  suppressOutput: true, // Output contains GeoRefData (large, proto-generated)
};

/** Handler for getting georeference data from disk. Requires redaction. */
export interface IGetFromDiskHandler extends IHandler<GetFromDiskInput, GetFromDiskOutput> {
  readonly redaction: RedactionSpec;
}
