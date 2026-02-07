import type { IHandler } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

export interface SetInDistInput {
  data: GeoRefData;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetInDistOutput {}

export type ISetInDistHandler = IHandler<SetInDistInput, SetInDistOutput>;
