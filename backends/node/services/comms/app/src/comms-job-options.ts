export interface CommsJobOptions {
  /** Retention period for soft-deleted messages in days. Default: 90. */
  readonly deletedMessageRetentionDays: number;
  /** Retention period for delivery history in days. Default: 365. */
  readonly deliveryHistoryRetentionDays: number;
  /** Distributed lock TTL in milliseconds. Default: 300000 (5 min). */
  readonly jobLockTtlMs: number;
}

export const DEFAULT_COMMS_JOB_OPTIONS: CommsJobOptions = {
  deletedMessageRetentionDays: 90,
  deliveryHistoryRetentionDays: 365,
  jobLockTtlMs: 300_000,
};
