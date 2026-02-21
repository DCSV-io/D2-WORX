import type { IHandleVerificationEmailHandler } from "./handle-verification-email.js";
import type { IHandlePasswordResetHandler } from "./handle-password-reset.js";
import type { IHandleInvitationEmailHandler } from "./handle-invitation-email.js";

export type {
  HandleVerificationEmailOutput,
  IHandleVerificationEmailHandler,
} from "./handle-verification-email.js";

export type {
  HandlePasswordResetOutput,
  IHandlePasswordResetHandler,
} from "./handle-password-reset.js";

export type {
  HandleInvitationEmailOutput,
  IHandleInvitationEmailHandler,
} from "./handle-invitation-email.js";

/** Bundle type for all delivery subscription handlers. */
export interface DeliverySubHandlers {
  handleVerificationEmail: IHandleVerificationEmailHandler;
  handlePasswordReset: IHandlePasswordResetHandler;
  handleInvitationEmail: IHandleInvitationEmailHandler;
}
