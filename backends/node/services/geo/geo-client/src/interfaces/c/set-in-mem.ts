import type { IHandler } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

export interface SetInMemInput {
  data: GeoRefData;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetInMemOutput {}

export type ISetInMemHandler = IHandler<SetInMemInput, SetInMemOutput>;
