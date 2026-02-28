// -----------------------------------------------------------------------
// <copyright file="dkron-client.ts" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

import type { ILogger } from "@d2/logging";
import type { DkronJob } from "./types.js";

const HEALTH_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Read the response body as text, returning empty string on failure. */
async function safeBodyText(res: Response): Promise<string> {
  return res.text().catch(() => "");
}

/**
 * Check whether Dkron is healthy AND the Raft leader is elected.
 *
 * The `/health` endpoint returns 200 as soon as the HTTP server starts, but
 * Dkron cannot accept job mutations until Raft has elected a leader. Checking
 * `/v1/leader` confirms the cluster is fully ready for writes.
 */
export async function checkHealth(baseUrl: string, logger: ILogger): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/v1/leader`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return false;

    const body = await res.text();
    if (!body || body.trim().length === 0) {
      logger.debug("Dkron /v1/leader returned empty body — Raft not ready");
      return false;
    }

    return true;
  } catch (err) {
    logger.debug("Dkron health check failed", err);
    return false;
  }
}

/**
 * List all jobs from Dkron.
 * Returns the full array -- caller is responsible for filtering to managed jobs.
 */
export async function listJobs(baseUrl: string, logger: ILogger): Promise<DkronJob[]> {
  const res = await fetch(`${baseUrl}/v1/jobs`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await safeBodyText(res);
    throw new Error(`Dkron GET /v1/jobs returned ${res.status}: ${body}`);
  }

  const raw = (await res.json()) as DkronJob[] | null;
  const jobs = raw ?? [];
  logger.debug(`Listed ${jobs.length} jobs from Dkron`);
  return jobs;
}

/**
 * Create or update a job in Dkron (upsert).
 * Dkron's POST /v1/jobs creates if the name is new, updates if it exists.
 */
export async function upsertJob(baseUrl: string, job: DkronJob, logger: ILogger): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await safeBodyText(res);
    throw new Error(`Dkron POST /v1/jobs (${job.name}) returned ${res.status}: ${body}`);
  }

  logger.debug(`Upserted job: ${job.name}`);
}

/**
 * Delete a job from Dkron by name.
 * Treats 404 as success (job already gone or Dkron internal error — Dkron uses
 * 404 for all gRPC failures, not just "not found").
 */
export async function deleteJob(baseUrl: string, name: string, logger: ILogger): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/jobs/${encodeURIComponent(name)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 404) {
    logger.warn(`DELETE /v1/jobs/${name} returned 404 (job already gone or Dkron internal error)`);
    return;
  }

  if (!res.ok) {
    const body = await safeBodyText(res);
    throw new Error(`Dkron DELETE /v1/jobs/${name} returned ${res.status}: ${body}`);
  }

  logger.debug(`Deleted job: ${name}`);
}
