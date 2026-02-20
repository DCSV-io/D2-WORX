import type { IHandler } from "@d2/handler";
import type { SendPasswordResetEvent } from "@d2/protos";

export interface HandlePasswordResetOutput {}

export type IHandlePasswordResetHandler = IHandler<
  SendPasswordResetEvent,
  HandlePasswordResetOutput
>;
