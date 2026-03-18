import type { IHandler } from "@d2/handler";
import type { File } from "@d2/files-domain";

export interface FindFileByIdInput {
  readonly id: string;
}

export interface FindFileByIdOutput {
  readonly file: File;
}

export type IFindFileByIdHandler = IHandler<FindFileByIdInput, FindFileByIdOutput>;
