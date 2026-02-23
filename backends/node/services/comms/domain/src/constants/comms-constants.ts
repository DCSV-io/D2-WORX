/**
 * Retry policy for delivery attempts.
 * Delays are indexed by attempt number (attempt 1 → index 0, etc.).
 * Overflow attempts use the last value in the array.
 */
export const RETRY_POLICY = {
  MAX_ATTEMPTS: 10,
  DELAYS_MS: [5_000, 10_000, 30_000, 60_000, 300_000] as readonly number[],
} as const;

/**
 * Default values for delivery processing.
 */
export const DELIVERY_DEFAULTS = {
  DEFAULT_CONTENT_FORMAT: "markdown",
} as const;

/**
 * Default channel enablement for new preferences.
 */
export const CHANNEL_DEFAULTS = {
  EMAIL_ENABLED: true,
  SMS_ENABLED: true,
} as const;

/**
 * Quiet hours validation bounds.
 * Hours are 0–23, minutes are 0–59. Format: "HH:MM".
 */
export const QUIET_HOURS = {
  MIN_HOUR: 0,
  MAX_HOUR: 23,
  MIN_MINUTE: 0,
  MAX_MINUTE: 59,
} as const;

/**
 * Constraints for threads, messages, attachments, and reactions.
 */
/**
 * Comms service messaging topology.
 *
 * The comms service owns its consumer queues. The exchange name comes from
 * AUTH_MESSAGING in @d2/auth-domain — these constants are for comms-internal use.
 */
export const COMMS_MESSAGING = {
  /** Queue bound to the auth events fanout exchange. */
  AUTH_EVENTS_QUEUE: "comms.auth-events",
  /** Sender service identifier for auth-originated deliveries. */
  SENDER_AUTH: "auth",
} as const;

/**
 * Well-known template names for delivery sub-handlers.
 *
 * These must match the names in the seed data (default-templates.ts).
 */
export const TEMPLATE_NAMES = {
  EMAIL_VERIFICATION: "email-verification",
  PASSWORD_RESET: "password-reset",
  INVITATION: "invitation",
} as const;

/**
 * Retry topology constants for DLX-based message retry.
 *
 * Messages that fail processing are re-published to a tier queue with an
 * appropriate TTL. When the TTL expires, RabbitMQ dead-letters the message
 * back to the main consumer queue via the requeue exchange.
 */
export const COMMS_RETRY = {
  /** Header name tracking the current retry attempt number. */
  RETRY_COUNT_HEADER: "x-retry-count",
  /** Exchange that routes expired tier-queue messages back to the main queue. */
  REQUEUE_EXCHANGE: "comms.retry.requeue",
  /** Prefix for tier delay queues (appended with tier number). */
  TIER_QUEUE_PREFIX: "comms.retry.tier-",
  /** TTL per tier — indexed by tier (tier-1 = index 0). Matches RETRY_POLICY.DELAYS_MS. */
  TIER_TTLS: [5_000, 10_000, 30_000, 60_000, 300_000] as readonly number[],
  /** Domain-specific error code: at least one delivery channel failed with retry scheduled. */
  DELIVERY_FAILED: "DELIVERY_FAILED",
} as const;

export const THREAD_CONSTRAINTS = {
  MAX_TITLE_LENGTH: 255,
  MAX_MESSAGE_LENGTH: 50_000,
  MAX_ATTACHMENTS_PER_MESSAGE: 20,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_REACTION_LENGTH: 64,
} as const;
