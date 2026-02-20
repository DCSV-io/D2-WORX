import type { IHandler } from "@d2/handler";
import type { SendVerificationEmailEvent } from "@d2/protos";

export interface HandleVerificationEmailOutput {}

export type IHandleVerificationEmailHandler = IHandler<
  SendVerificationEmailEvent,
  HandleVerificationEmailOutput
>;
