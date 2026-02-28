// -----------------------------------------------------------------------
// <copyright file="config.ts" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

import type { ILogger } from "@d2/logging";

const DEFAULT_RECONCILE_INTERVAL_MS = 300_000; // 5 minutes
const MIN_RECONCILE_INTERVAL_MS = 1_000; // 1 second floor

export interface DkronMgrConfig {
  /** Dkron REST API base URL (e.g. http://localhost:8888). */
  readonly dkronUrl: string;
  /** Gateway base URL as seen from the Dkron container (e.g. http://host.docker.internal:5461). */
  readonly gatewayUrl: string;
  /** X-Api-Key for Dkron -> Gateway authentication. */
  readonly serviceKey: string;
  /** Reconciliation loop interval in milliseconds (default: 300000 = 5 min). */
  readonly reconcileIntervalMs: number;
}

/**
 * Parse and validate config from environment variables.
 * Exits the process if required variables are missing.
 */
export function parseConfig(logger: ILogger): DkronMgrConfig {
  const dkronUrl = process.env.DKRON_MGR__DKRON_URL?.replace(/\/+$/, "");
  const gatewayUrl = process.env.DKRON_MGR__GATEWAY_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.DKRON_MGR__SERVICE_KEY;

  const missing: string[] = [];
  if (!dkronUrl) missing.push("DKRON_MGR__DKRON_URL");
  if (!gatewayUrl) missing.push("DKRON_MGR__GATEWAY_URL");
  if (!serviceKey) missing.push("DKRON_MGR__SERVICE_KEY");

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  const parsed = parseInt(process.env.DKRON_MGR__RECONCILE_INTERVAL_MS ?? "", 10);
  const reconcileIntervalMs =
    Number.isNaN(parsed) || parsed < MIN_RECONCILE_INTERVAL_MS
      ? DEFAULT_RECONCILE_INTERVAL_MS
      : parsed;

  return Object.freeze({
    dkronUrl: dkronUrl!,
    gatewayUrl: gatewayUrl!,
    serviceKey: serviceKey!,
    reconcileIntervalMs,
  });
}

const REDACT_VISIBLE_CHARS = 8;

/** Log config with the service key redacted. */
export function logConfig(config: DkronMgrConfig, logger: ILogger): void {
  const redactedKey =
    config.serviceKey.length > REDACT_VISIBLE_CHARS
      ? `${config.serviceKey.slice(0, REDACT_VISIBLE_CHARS)}...`
      : "***";

  logger.info("Configuration loaded", {
    dkronUrl: config.dkronUrl,
    gatewayUrl: config.gatewayUrl,
    serviceKey: redactedKey,
    reconcileIntervalMs: config.reconcileIntervalMs,
  });
}
