import type { IHandler, RedactionSpec } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

export interface SetOnDiskInput {
  data: GeoRefData;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetOnDiskOutput {}

/** Recommended redaction for SetOnDisk handlers. */
export const SET_ON_DISK_REDACTION: RedactionSpec = {
  suppressInput: true, // Input contains GeoRefData (large, proto-generated)
};

/** Handler for persisting georeference data to disk. Requires redaction. */
export interface ISetOnDiskHandler extends IHandler<SetOnDiskInput, SetOnDiskOutput> {
  readonly redaction: RedactionSpec;
}
