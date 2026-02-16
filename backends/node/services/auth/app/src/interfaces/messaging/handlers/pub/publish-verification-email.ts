import type { IHandler } from "@d2/handler";
import type { SendVerificationEmail } from "../../../../messages/send-verification-email.js";

export interface PublishVerificationEmailOutput {}

export type IPublishVerificationEmailHandler = IHandler<
  SendVerificationEmail,
  PublishVerificationEmailOutput
>;
