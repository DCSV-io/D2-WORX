import type { IHandler } from "@d2/handler";

export interface CountSignInEventsByUserIdInput {
  readonly userId: string;
}

export interface CountSignInEventsByUserIdOutput {
  readonly count: number;
}

export type ICountSignInEventsByUserIdHandler =
  IHandler<CountSignInEventsByUserIdInput, CountSignInEventsByUserIdOutput>;
