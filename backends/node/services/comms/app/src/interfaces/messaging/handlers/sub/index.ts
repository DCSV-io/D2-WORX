import type { IHandleVerificationEmailHandler } from "./handle-verification-email.js";
import type { IHandlePasswordResetHandler } from "./handle-password-reset.js";

export type {
  HandleVerificationEmailOutput,
  IHandleVerificationEmailHandler,
} from "./handle-verification-email.js";

export type {
  HandlePasswordResetOutput,
  IHandlePasswordResetHandler,
} from "./handle-password-reset.js";

/** Bundle type for all delivery subscription handlers. */
export interface DeliverySubHandlers {
  handleVerificationEmail: IHandleVerificationEmailHandler;
  handlePasswordReset: IHandlePasswordResetHandler;
}
