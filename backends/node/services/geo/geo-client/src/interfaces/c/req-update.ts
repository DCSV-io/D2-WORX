import type { IHandler } from "@d2/handler";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors .NET ReqUpdateInput
export interface ReqUpdateInput {}

export interface ReqUpdateOutput {
  version: string | undefined;
}

export type IReqUpdateHandler = IHandler<ReqUpdateInput, ReqUpdateOutput>;
