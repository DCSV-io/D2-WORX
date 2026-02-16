import type { IHandler } from "@d2/handler";
import type { EmulationConsent } from "@d2/auth-domain";

export interface FindActiveConsentsByUserIdInput {
  readonly userId: string;
  readonly limit: number;
  readonly offset: number;
}

export interface FindActiveConsentsByUserIdOutput {
  readonly consents: EmulationConsent[];
}

export type IFindActiveConsentsByUserIdHandler = IHandler<
  FindActiveConsentsByUserIdInput,
  FindActiveConsentsByUserIdOutput
>;
