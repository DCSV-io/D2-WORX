import type { IHandler } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetFromDiskInput
export interface GetFromDiskInput {}

export interface GetFromDiskOutput {
  data: GeoRefData;
}

export type IGetFromDiskHandler = IHandler<GetFromDiskInput, GetFromDiskOutput>;
