// -----------------------------------------------------------------------
// <copyright file="reconciler.ts" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

import type { ILogger } from "@d2/logging";
import type { DkronMgrConfig } from "./config.js";
import { listJobs, upsertJob, deleteJob } from "./dkron-client.js";
import { getDesiredJobs } from "./job-definitions.js";
import type { DkronJob, JobFields, ReconcileError, ReconcileResult } from "./types.js";

const MANAGED_BY_KEY = "managed_by";
const MANAGED_BY_VALUE = "d2-dkron-mgr";

/**
 * Build a deterministic comparison string from the fields the reconciler controls.
 * Server-managed fields (success_count, last_success, next, etc.) are excluded.
 */
export function buildComparableKey(job: JobFields): string {
  const sortedConfig = Object.fromEntries(
    Object.entries(job.executor_config).sort(([a], [b]) => a.localeCompare(b)),
  );

  return JSON.stringify({
    displayname: job.displayname,
    schedule: job.schedule,
    timezone: job.timezone,
    executor: job.executor,
    executor_config: sortedConfig,
    concurrency: job.concurrency,
    retries: job.retries,
    disabled: job.disabled,
  });
}

/** Convert a desired job definition into a full DkronJob payload with managed_by metadata. */
function toUpsertPayload(desired: JobFields): DkronJob {
  return {
    ...desired,
    metadata: { [MANAGED_BY_KEY]: MANAGED_BY_VALUE },
  };
}

/**
 * Run one reconciliation cycle: compare desired state against Dkron's actual
 * state and create, update, or delete jobs as needed.
 *
 * Each individual operation is wrapped in try/catch so one failure does not
 * block others. Failures are accumulated in the result's `errors` array.
 */
export async function reconcile(
  config: DkronMgrConfig,
  logger: ILogger,
): Promise<ReconcileResult> {
  const created: string[] = [];
  const updated: string[] = [];
  const deleted: string[] = [];
  const unchanged: string[] = [];
  const errors: ReconcileError[] = [];

  // 1. Build desired state.
  const desiredJobs = getDesiredJobs(config);
  const desiredByName = new Map(desiredJobs.map((j) => [j.name, j]));

  // 2. Fetch actual state from Dkron and filter to managed jobs only.
  const allJobs = await listJobs(config.dkronUrl, logger);
  const managedJobs = allJobs.filter(
    (j) => j.metadata?.[MANAGED_BY_KEY] === MANAGED_BY_VALUE,
  );
  const actualByName = new Map(managedJobs.map((j) => [j.name, j]));

  // 3. Create or update desired jobs.
  for (const desired of desiredJobs) {
    const actual = actualByName.get(desired.name);

    if (!actual) {
      // Job missing from Dkron — create it.
      try {
        await upsertJob(config.dkronUrl, toUpsertPayload(desired), logger);
        created.push(desired.name);
      } catch (err) {
        errors.push({ job: desired.name, operation: "create", error: String(err) });
      }
    } else if (buildComparableKey(desired) !== buildComparableKey(actual)) {
      // Job exists but has changed — update it.
      try {
        await upsertJob(config.dkronUrl, toUpsertPayload(desired), logger);
        updated.push(desired.name);
      } catch (err) {
        errors.push({ job: desired.name, operation: "update", error: String(err) });
      }
    } else {
      // Job exists and matches desired state.
      unchanged.push(desired.name);
    }
  }

  // 4. Delete orphaned managed jobs (tagged but no longer in desired set).
  for (const actual of managedJobs) {
    if (!desiredByName.has(actual.name)) {
      try {
        await deleteJob(config.dkronUrl, actual.name, logger);
        deleted.push(actual.name);
      } catch (err) {
        errors.push({ job: actual.name, operation: "delete", error: String(err) });
      }
    }
  }

  return { created, updated, deleted, unchanged, errors };
}
