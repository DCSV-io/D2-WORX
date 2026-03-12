import type { IHandler } from "@d2/handler";

export interface RecordSignInOutcomeInput {
  readonly identifierHash: string;
  readonly identityHash: string;
  readonly responseStatus: number;
}

export interface RecordSignInOutcomeOutput {
  readonly recorded: boolean;
}

/** Handler for recording sign-in outcomes for brute-force throttling. */
export interface IRecordSignInOutcomeHandler extends IHandler<
  RecordSignInOutcomeInput,
  RecordSignInOutcomeOutput
> {}
