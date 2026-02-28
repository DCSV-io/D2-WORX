// -----------------------------------------------------------------------
// <copyright file="types.ts" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

/**
 * Core job fields shared between desired definitions and Dkron API responses.
 * Server-managed fields (success_count, error_count, last_success, next, etc.)
 * are intentionally omitted — only reconciler-controlled fields appear here.
 */
export interface JobFields {
  readonly name: string;
  readonly displayname: string;
  readonly schedule: string;
  readonly timezone: string;
  readonly executor: string;
  readonly executor_config: Record<string, string>;
  readonly concurrency: string;
  readonly retries: number;
  readonly disabled: boolean;
}

/**
 * A job definition as declared in job-definitions.ts.
 * Does NOT include metadata — the reconciler injects `managed_by` before upserting.
 */
export type DesiredJob = JobFields;

/**
 * Dkron job shape as returned by GET /v1/jobs.
 * Extends the core fields with server-side metadata.
 */
export interface DkronJob extends JobFields {
  readonly metadata?: Record<string, string> | null;
}

/** Result of a single reconciliation cycle. */
export interface ReconcileResult {
  readonly created: string[];
  readonly updated: string[];
  readonly deleted: string[];
  readonly unchanged: string[];
  readonly errors: ReconcileError[];
}

export interface ReconcileError {
  readonly job: string;
  readonly operation: "create" | "update" | "delete";
  readonly error: string;
}
