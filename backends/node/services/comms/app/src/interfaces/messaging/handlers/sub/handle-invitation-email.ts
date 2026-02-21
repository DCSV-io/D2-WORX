import type { IHandler } from "@d2/handler";
import type { SendInvitationEmailEvent } from "@d2/protos";

export interface HandleInvitationEmailOutput {}

export type IHandleInvitationEmailHandler = IHandler<
  SendInvitationEmailEvent,
  HandleInvitationEmailOutput
>;
