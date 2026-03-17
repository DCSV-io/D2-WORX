import type { ContentCategory } from "../enums/content-category.js";
import type { VariantSize } from "../enums/variant-size.js";

/**
 * Maximum file size limits in bytes, per purpose.
 */
export const FILES_SIZE_LIMITS = {
  DEFAULT_MAX_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB
  AVATAR_MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  DOCUMENT_MAX_SIZE_BYTES: 25 * 1024 * 1024, // 25 MB
  ATTACHMENT_MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
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
 * Dimensions per variant size. Width/height of 0 = no resize (original).
 */
export const VARIANT_CONFIGS: Readonly<Record<VariantSize, { width: number; height: number }>> = {
  thumb: { width: 64, height: 64 },
  small: { width: 128, height: 128 },
  medium: { width: 512, height: 512 },
  large: { width: 1024, height: 1024 },
  original: { width: 0, height: 0 },
};

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
 * Context key prefix → access resolution strategy.
 *
 * - `jwt` — resolved from JWT claims (userId, orgId)
 * - `callback` — resolved via external access check (e.g., thread membership)
 */
export const CONTEXT_KEY_PREFIXES: Readonly<
  Record<string, { prefix: string; resolution: "jwt" | "callback" }>
> = {
  user_: { prefix: "user_", resolution: "jwt" },
  org_: { prefix: "org_", resolution: "jwt" },
  thread_: { prefix: "thread_", resolution: "callback" },
};

/**
 * Well-known context keys for common file purposes.
 */
export const FILES_CONTEXT_KEYS = {
  USER_AVATAR: "user_avatar",
  ORG_LOGO: "org_logo",
  ORG_DOCUMENT: "org_document",
  THREAD_ATTACHMENT: "thread_attachment",
} as const;

/**
 * Messaging topology for the files service.
 */
export const FILES_MESSAGING = {
  /** Topic exchange for file lifecycle events. */
  EVENTS_EXCHANGE: "files.events",
  /** Exchange type for file events. */
  EVENTS_EXCHANGE_TYPE: "topic" as const,
  /** Queue for file processing workers. */
  PROCESSING_QUEUE: "files.processing",
} as const;

/**
 * Processing pipeline constants.
 */
export const FILES_PROCESSING = {
  /** Minutes before a "processing" file is considered stuck. */
  STUCK_PROCESSING_THRESHOLD_MINUTES: 15,
} as const;
