export interface FilesJobOptions {
  /** Minutes before a "pending" file is considered stale. Default: 15. */
  readonly pendingThresholdMinutes: number;
  /** Minutes before a "processing" file is considered stale. Default: 30. */
  readonly processingThresholdMinutes: number;
  /** Days before a "rejected" file is cleaned up. Default: 30. */
  readonly rejectedThresholdDays: number;
  /** Distributed lock TTL in milliseconds. Default: 300000 (5 min). */
  readonly jobLockTtlMs: number;
}

export const DEFAULT_FILES_JOB_OPTIONS: FilesJobOptions = {
  pendingThresholdMinutes: 15,
  processingThresholdMinutes: 30,
  rejectedThresholdDays: 30,
  jobLockTtlMs: 300_000,
};
