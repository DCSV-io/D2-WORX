import type { IHandler, RedactionSpec } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

export interface SetInMemInput {
  data: GeoRefData;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetInMemOutput {}

/** Recommended redaction for SetInMem handlers. */
export const SET_IN_MEM_REDACTION: RedactionSpec = {
  suppressInput: true, // Input contains GeoRefData (large, proto-generated)
};

/** Handler for setting georeference data in memory. Requires redaction. */
export interface ISetInMemHandler extends IHandler<SetInMemInput, SetInMemOutput> {
  readonly redaction: RedactionSpec;
}
