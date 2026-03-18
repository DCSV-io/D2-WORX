import type { IHandler } from "@d2/handler";
import type { File } from "@d2/files-domain";

export interface GetFileMetadataInput {
  readonly fileId: string;
}

export interface GetFileMetadataOutput {
  readonly file: File;
}

export interface IGetFileMetadataHandler extends IHandler<
  GetFileMetadataInput,
  GetFileMetadataOutput
> {}
