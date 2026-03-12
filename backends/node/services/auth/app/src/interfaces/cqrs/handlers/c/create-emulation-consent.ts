import type { IHandler } from "@d2/handler";
import type { EmulationConsent, OrgType } from "@d2/auth-domain";

export interface CreateEmulationConsentInput {
  readonly userId: string;
  readonly grantedToOrgId: string;
  readonly activeOrgType: OrgType;
  readonly expiresAt: Date;
}

export type CreateEmulationConsentOutput = { consent: EmulationConsent };

/** Handler for creating emulation consent records. */
export interface ICreateEmulationConsentHandler
  extends IHandler<CreateEmulationConsentInput, CreateEmulationConsentOutput> {}
