import type { IHandler } from "@d2/handler";
import type { SendPasswordReset } from "../../../../messages/send-password-reset.js";

export interface PublishPasswordResetOutput {}

export type IPublishPasswordResetHandler = IHandler<SendPasswordReset, PublishPasswordResetOutput>;
