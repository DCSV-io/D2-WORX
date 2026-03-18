// --- Handler type imports (used by bundle interface below) ---
import type { ICreateFileRecordHandler } from "./c/create-file-record.js";
import type { IFindFileByIdHandler } from "./r/find-file-by-id.js";
import type { IFindFilesByContextHandler } from "./r/find-files-by-context.js";
import type { IUpdateFileRecordHandler } from "./u/update-file-record.js";
import type { IDeleteFileRecordHandler } from "./d/delete-file-record.js";
import type { IDeleteFileRecordsByIdsHandler } from "./d/delete-file-records-by-ids.js";

// --- Create (C) ---
export type {
  CreateFileRecordInput,
  CreateFileRecordOutput,
  ICreateFileRecordHandler,
} from "./c/create-file-record.js";

// --- Read (R) ---
export type {
  FindFileByIdInput,
  FindFileByIdOutput,
  IFindFileByIdHandler,
} from "./r/find-file-by-id.js";

export type {
  FindFilesByContextInput,
  FindFilesByContextOutput,
  IFindFilesByContextHandler,
} from "./r/find-files-by-context.js";

export type {
  FindStaleFilesInput,
  FindStaleFilesOutput,
  IFindStaleFilesHandler,
} from "./r/find-stale-files.js";

export type { PingDbInput, PingDbOutput, IPingDbHandler } from "./r/ping-db.js";

// --- Update (U) ---
export type {
  UpdateFileRecordInput,
  UpdateFileRecordOutput,
  IUpdateFileRecordHandler,
} from "./u/update-file-record.js";

// --- Delete (D) ---
export type {
  DeleteFileRecordInput,
  DeleteFileRecordOutput,
  IDeleteFileRecordHandler,
} from "./d/delete-file-record.js";

export type {
  DeleteFileRecordsByIdsInput,
  DeleteFileRecordsByIdsOutput,
  IDeleteFileRecordsByIdsHandler,
} from "./d/delete-file-records-by-ids.js";

// ---------------------------------------------------------------------------
// Bundle type — passed to app-layer handlers as a single object
// ---------------------------------------------------------------------------

export interface FileRepoHandlers {
  create: ICreateFileRecordHandler;
  findById: IFindFileByIdHandler;
  findByContext: IFindFilesByContextHandler;
  update: IUpdateFileRecordHandler;
  delete: IDeleteFileRecordHandler;
  deleteByIds: IDeleteFileRecordsByIdsHandler;
}
