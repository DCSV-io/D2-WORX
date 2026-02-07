import type { IHandler } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetFromMemInput
export interface GetFromMemInput {}

export interface GetFromMemOutput {
  data: GeoRefData;
}

export type IGetFromMemHandler = IHandler<GetFromMemInput, GetFromMemOutput>;
