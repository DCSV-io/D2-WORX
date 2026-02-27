import { cleanStr, generateUuidV7 } from "@d2/utilities";
import { CommsValidationError } from "../exceptions/comms-validation-error.js";
import { THREAD_CONSTRAINTS } from "../constants/comms-constants.js";

/**
 * File attached to a message. Immutable — no updates.
 *
 * File storage is handled by the media service (MinIO/S3);
 * this entity stores the reference metadata.
 */
export interface MessageAttachment {
  readonly id: string;
  readonly messageId: string;
  readonly fileUrl: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly fileSize: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateMessageAttachmentInput {
  readonly messageId: string;
  readonly fileUrl: string;
  readonly fileName: string;
  readonly fileType: string;
  readonly fileSize: number;
  readonly id?: string;
}

/**
 * Creates a message attachment. Immutable — no updates.
 */
export function createMessageAttachment(input: CreateMessageAttachmentInput): MessageAttachment {
  if (!input.messageId) {
    throw new CommsValidationError(
      "MessageAttachment",
      "messageId",
      input.messageId,
      "is required.",
    );
  }

  if (!input.fileUrl) {
    throw new CommsValidationError("MessageAttachment", "fileUrl", input.fileUrl, "is required.");
  }

  const fileName = cleanStr(input.fileName);
  if (!fileName) {
    throw new CommsValidationError("MessageAttachment", "fileName", input.fileName, "is required.");
  }

  const fileType = cleanStr(input.fileType);
  if (!fileType) {
    throw new CommsValidationError("MessageAttachment", "fileType", input.fileType, "is required.");
  }

  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    throw new CommsValidationError(
      "MessageAttachment",
      "fileSize",
      input.fileSize,
      "must be a positive number.",
    );
  }

  if (input.fileSize > THREAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES) {
    throw new CommsValidationError(
      "MessageAttachment",
      "fileSize",
      input.fileSize,
      `must not exceed ${THREAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES} bytes (50 MB).`,
    );
  }

  const now = new Date();

  return {
    id: input.id ?? generateUuidV7(),
    messageId: input.messageId,
    fileUrl: input.fileUrl,
    fileName,
    fileType,
    fileSize: input.fileSize,
    createdAt: now,
    updatedAt: now,
  };
}
