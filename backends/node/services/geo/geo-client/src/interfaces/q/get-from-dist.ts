import type { IHandler } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetFromDistInput
export interface GetFromDistInput {}

export interface GetFromDistOutput {
  data: GeoRefData;
}

export type IGetFromDistHandler = IHandler<GetFromDistInput, GetFromDistOutput>;
