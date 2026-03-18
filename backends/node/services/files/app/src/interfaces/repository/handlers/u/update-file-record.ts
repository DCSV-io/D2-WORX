import type { IHandler } from "@d2/handler";
import type { File } from "@d2/files-domain";

export interface UpdateFileRecordInput {
  readonly file: File;
}

export interface UpdateFileRecordOutput {
  readonly file: File;
}

export type IUpdateFileRecordHandler = IHandler<UpdateFileRecordInput, UpdateFileRecordOutput>;
