import type { IHandler } from "@d2/handler";

export interface ReqUpdateInput {}

export interface ReqUpdateOutput {
  version: string | undefined;
}

export type IReqUpdateHandler = IHandler<ReqUpdateInput, ReqUpdateOutput>;
