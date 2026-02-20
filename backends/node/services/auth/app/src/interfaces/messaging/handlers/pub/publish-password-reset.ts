import type { IHandler } from "@d2/handler";
import type { SendPasswordReset } from "../../../../messages/index.js";

export interface PublishPasswordResetOutput {}

export type IPublishPasswordResetHandler = IHandler<SendPasswordReset, PublishPasswordResetOutput>;
