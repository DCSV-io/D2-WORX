import type { IHandler, RedactionSpec } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

export interface SetInDistInput {
  data: GeoRefData;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetInDistOutput {}

/** Recommended redaction for SetInDist handlers. */
export const SET_IN_DIST_REDACTION: RedactionSpec = {
  suppressInput: true, // Input contains GeoRefData (large, proto-generated)
};

/** Handler for setting georeference data in distributed cache. Requires redaction. */
export interface ISetInDistHandler extends IHandler<SetInDistInput, SetInDistOutput> {
  readonly redaction: RedactionSpec;
}
