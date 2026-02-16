import type { IHandler } from "@d2/handler";

export interface GetLatestSignInEventDateInput {
  readonly userId: string;
}

export interface GetLatestSignInEventDateOutput {
  readonly date: Date | null;
}

export type IGetLatestSignInEventDateHandler = IHandler<
  GetLatestSignInEventDateInput,
  GetLatestSignInEventDateOutput
>;
