export interface AuthJobOptions {
  /** Retention period for sign-in events in days. Default: 90. */
  readonly signInEventRetentionDays: number;
  /** Retention period for expired invitations in days past expiry. Default: 7. */
  readonly invitationRetentionDays: number;
  /** Distributed lock TTL in milliseconds. Default: 300000 (5 min). */
  readonly lockTtlMs: number;
}

export const DEFAULT_AUTH_JOB_OPTIONS: AuthJobOptions = {
  signInEventRetentionDays: 90,
  invitationRetentionDays: 7,
  lockTtlMs: 300_000,
};
