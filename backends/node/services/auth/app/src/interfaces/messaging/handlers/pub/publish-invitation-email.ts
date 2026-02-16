import type { IHandler } from "@d2/handler";
import type { SendInvitationEmail } from "../../../../messages/send-invitation-email.js";

export interface PublishInvitationEmailOutput {}

export type IPublishInvitationEmailHandler = IHandler<
  SendInvitationEmail,
  PublishInvitationEmailOutput
>;
