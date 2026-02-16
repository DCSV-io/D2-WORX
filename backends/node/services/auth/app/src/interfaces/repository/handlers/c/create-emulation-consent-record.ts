import type { IHandler } from "@d2/handler";
import type { EmulationConsent } from "@d2/auth-domain";

export interface CreateEmulationConsentRecordInput {
  readonly consent: EmulationConsent;
}

export interface CreateEmulationConsentRecordOutput {}

export type ICreateEmulationConsentRecordHandler = IHandler<
  CreateEmulationConsentRecordInput,
  CreateEmulationConsentRecordOutput
>;
