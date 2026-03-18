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
 * MinIO publishes bucket notification events to the direct exchange.
 * All Files service instances consume from the same durable queue
 * (competing consumers — each file processed by exactly one worker).
 */
export const FILES_MESSAGING = {
  /** Direct exchange for MinIO bucket notification events. */
  EVENTS_EXCHANGE: "files.events",
  /** Exchange type — direct (competing consumers via shared queue). */
  EVENTS_EXCHANGE_TYPE: "direct" as const,
  /** Routing key for file event messages. */
  EVENTS_ROUTING_KEY: "file-uploaded",
  /** Work queue bound to the events exchange (single delivery per message). */
  PROCESSING_QUEUE: "files.processing",
} as const;
