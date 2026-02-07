import type { IHandler } from "@d2/handler";
import type { GeoRefData } from "@d2/protos";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET GetInput
export interface GetInput {}

export interface GetOutput {
  data: GeoRefData;
}

export type IGetHandler = IHandler<GetInput, GetOutput>;
