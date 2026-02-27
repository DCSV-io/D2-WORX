import type { IHandler } from "@d2/handler";

export interface UpdateSignInEventWhoIsIdInput {
  readonly id: string;
  readonly whoIsId: string;
}

export interface UpdateSignInEventWhoIsIdOutput {}

export type IUpdateSignInEventWhoIsIdHandler = IHandler<
  UpdateSignInEventWhoIsIdInput,
  UpdateSignInEventWhoIsIdOutput
>;
