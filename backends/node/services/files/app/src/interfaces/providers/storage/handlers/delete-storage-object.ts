import type { IHandler } from "@d2/handler";

export interface DeleteStorageObjectInput {
  readonly key: string;
}

export interface DeleteStorageObjectOutput {}

/** Deletes a single object by key from object storage. */
export type IDeleteStorageObject = IHandler<DeleteStorageObjectInput, DeleteStorageObjectOutput>;
