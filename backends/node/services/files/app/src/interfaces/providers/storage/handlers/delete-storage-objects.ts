import type { IHandler } from "@d2/handler";

export interface DeleteStorageObjectsInput {
  readonly keys: string[];
}

export interface DeleteStorageObjectsOutput {}

/** Deletes multiple objects by key from object storage. Silently ignores missing keys. */
export type IDeleteStorageObjects = IHandler<DeleteStorageObjectsInput, DeleteStorageObjectsOutput>;
