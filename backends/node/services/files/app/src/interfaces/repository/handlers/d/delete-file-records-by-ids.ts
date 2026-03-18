import type { IHandler } from "@d2/handler";

export interface DeleteFileRecordsByIdsInput {
  readonly ids: readonly string[];
}

export interface DeleteFileRecordsByIdsOutput {
  readonly rowsAffected: number;
}

export type IDeleteFileRecordsByIdsHandler = IHandler<
  DeleteFileRecordsByIdsInput,
  DeleteFileRecordsByIdsOutput
>;
