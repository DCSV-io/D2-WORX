import type { IPublishVerificationEmailHandler } from "./publish-verification-email.js";
import type { IPublishPasswordResetHandler } from "./publish-password-reset.js";
import type { IPublishInvitationEmailHandler } from "./publish-invitation-email.js";

export type {
  PublishVerificationEmailOutput,
  IPublishVerificationEmailHandler,
} from "./publish-verification-email.js";

export type {
  PublishPasswordResetOutput,
  IPublishPasswordResetHandler,
} from "./publish-password-reset.js";

export type {
  PublishInvitationEmailOutput,
  IPublishInvitationEmailHandler,
} from "./publish-invitation-email.js";

/** Bundle type for all notification publisher handlers. */
export interface NotificationPublisherHandlers {
  publishVerificationEmail: IPublishVerificationEmailHandler;
  publishPasswordReset: IPublishPasswordResetHandler;
  publishInvitationEmail: IPublishInvitationEmailHandler;
}
