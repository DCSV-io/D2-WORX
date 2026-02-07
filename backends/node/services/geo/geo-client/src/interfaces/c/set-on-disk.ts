import type { IHandler } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

export interface SetOnDiskInput {
  data: GeoRefData;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SetOnDiskOutput {}

export type ISetOnDiskHandler = IHandler<SetOnDiskInput, SetOnDiskOutput>;
