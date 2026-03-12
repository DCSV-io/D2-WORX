import type { IHandler } from "@d2/handler";
import type { EmulationConsent } from "@d2/auth-domain";

export interface GetActiveConsentsInput {
  readonly userId: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface GetActiveConsentsOutput {
  consents: EmulationConsent[];
}

/** Handler for retrieving active emulation consents. */
export interface IGetActiveConsentsHandler
  extends IHandler<GetActiveConsentsInput, GetActiveConsentsOutput> {}
