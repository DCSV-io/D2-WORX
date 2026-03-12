import type { IHandler } from "@d2/handler";
import type { EmulationConsent } from "@d2/auth-domain";

export interface RevokeEmulationConsentInput {
  readonly consentId: string;
  /** The authenticated user's ID — used to verify ownership. */
  readonly userId: string;
}

export type RevokeEmulationConsentOutput = { consent: EmulationConsent };

/** Handler for revoking emulation consent records. */
export interface IRevokeEmulationConsentHandler
  extends IHandler<RevokeEmulationConsentInput, RevokeEmulationConsentOutput> {}
