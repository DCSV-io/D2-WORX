import type { IHandler } from "@d2/handler";

export interface RevokeEmulationConsentRecordInput {
  readonly id: string;
}

export interface RevokeEmulationConsentRecordOutput {}

export type IRevokeEmulationConsentRecordHandler =
  IHandler<RevokeEmulationConsentRecordInput, RevokeEmulationConsentRecordOutput>;
