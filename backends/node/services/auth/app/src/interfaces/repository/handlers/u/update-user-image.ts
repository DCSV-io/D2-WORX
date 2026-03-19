import type { IHandler } from "@d2/handler";

export interface UpdateUserImageInput {
  readonly userId: string;
  readonly image: string | null;
}

export interface UpdateUserImageOutput {}

export type IUpdateUserImageHandler = IHandler<UpdateUserImageInput, UpdateUserImageOutput>;
