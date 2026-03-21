import type { File, FileStatus, RejectionReason, FileVariant } from "@d2/files-domain";
import type { FileRow } from "../schema/types.js";

/**
 * Maps a Drizzle file row to a File domain entity.
 */
export function toFile(row: FileRow): File {
  return {
    id: row.id,
    contextKey: row.contextKey,
    relatedEntityId: row.relatedEntityId,
    uploaderUserId: row.uploaderUserId,
    status: row.status as FileStatus,
    contentType: row.contentType,
    displayName: row.displayName,
    sizeBytes: row.sizeBytes,
    variants: row.variants ? (row.variants as FileVariant[]) : undefined,
    rejectionReason: row.rejectionReason ? (row.rejectionReason as RejectionReason) : undefined,
    createdAt: row.createdAt,
  };
}
