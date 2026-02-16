import type { IHandler } from "@d2/handler";
import type { EmulationConsent } from "@d2/auth-domain";

export interface FindEmulationConsentByIdInput {
  readonly id: string;
}

export interface FindEmulationConsentByIdOutput {
  readonly consent: EmulationConsent;
}

export type IFindEmulationConsentByIdHandler = IHandler<
  FindEmulationConsentByIdInput,
  FindEmulationConsentByIdOutput
>;
