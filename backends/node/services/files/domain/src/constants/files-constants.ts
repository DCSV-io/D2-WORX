import type { ContentCategory } from "../enums/content-category.js";

/**
 * Default maximum file size in bytes.
 * Per-context-key overrides are runtime config (app layer).
 */
export const FILES_SIZE_LIMITS = {
  DEFAULT_MAX_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB
} as const;

/**
 * Maximum string field lengths for file entities.
 */
export const FILES_FIELD_LIMITS = {
  MAX_CONTEXT_KEY_LENGTH: 100,
  MAX_RELATED_ENTITY_ID_LENGTH: 255,
  MAX_CONTENT_TYPE_LENGTH: 255,
  MAX_DISPLAY_NAME_LENGTH: 255,
  MAX_VARIANT_KEY_LENGTH: 512,
} as const;

/**
 * Allowed MIME content types per content category.
 */
export const ALLOWED_CONTENT_TYPES: Readonly<Record<ContentCategory, readonly string[]>> = {
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
    "image/heic",
    "image/heif",
  ],
  document: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
  video: ["video/mp4", "video/webm", "video/quicktime", "video/3gpp"],
  audio: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/mp4"],
};

/**
 * Messaging topology for the files service.
 *
 * Two-stage pipeline:
 * 1. MinIO → "files.events" exchange (routing key "file-uploaded") → "files.intake" queue
 *    → IntakeFileUploaded consumer validates the pending record, then publishes to stage 2.
 * 2. "files.events" exchange (routing key "file-process") → "files.processing" queue
 *    → ProcessUploadedFile consumer runs scan/transform/notify pipeline.
 *
 * Both queues use competing consumers (each message processed by exactly one worker).
 */
export const FILES_MESSAGING = {
  /** Direct exchange for all files lifecycle events. */
  EVENTS_EXCHANGE: "files.events",
  /** Exchange type — direct routing. */
  EVENTS_EXCHANGE_TYPE: "direct" as const,
  /** Routing key for MinIO bucket notification events (upload completed). */
  UPLOAD_ROUTING_KEY: "file-uploaded",
  /** Routing key for internal processing dispatch (post-intake). */
  PROCESSING_ROUTING_KEY: "file-process",
  /** Queue for MinIO upload notifications → intake handler. */
  INTAKE_QUEUE: "files.intake",
  /** Queue for processing dispatch → process handler. */
  PROCESSING_QUEUE: "files.processing",
} as const;
