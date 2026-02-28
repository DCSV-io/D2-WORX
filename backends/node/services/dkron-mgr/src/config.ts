// -----------------------------------------------------------------------
// <copyright file="config.ts" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

import type { ILogger } from "@d2/logging";
import {
  defineConfig,
  requiredString,
  requiredParsed,
  optionalString,
} from "@d2/service-defaults/config";

const DEFAULT_RECONCILE_INTERVAL_MS = 300_000; // 5 minutes
const MIN_RECONCILE_INTERVAL_MS = 1_000; // 1 second floor

/** Strip trailing slashes from a URL. Returns the URL as-is if non-empty. */
function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

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
 * Throws ConfigError if required variables are missing.
 */
export function parseConfig(_logger: ILogger): DkronMgrConfig {
  const raw = defineConfig("dkron-mgr", {
    dkronUrl: requiredParsed(stripTrailingSlashes, "DKRON_MGR__DKRON_URL"),
    gatewayUrl: requiredParsed(stripTrailingSlashes, "DKRON_MGR__GATEWAY_URL"),
    serviceKey: requiredString("DKRON_MGR__SERVICE_KEY"),
    reconcileIntervalRaw: optionalString("DKRON_MGR__RECONCILE_INTERVAL_MS"),
  });

  // Graceful fallback: invalid or below-floor values use the default (no crash)
  const parsed = raw.reconcileIntervalRaw ? parseInt(raw.reconcileIntervalRaw, 10) : NaN;
  const reconcileIntervalMs =
    Number.isFinite(parsed) && parsed >= MIN_RECONCILE_INTERVAL_MS
      ? parsed
      : DEFAULT_RECONCILE_INTERVAL_MS;

  return Object.freeze({
    dkronUrl: raw.dkronUrl,
    gatewayUrl: raw.gatewayUrl,
    serviceKey: raw.serviceKey,
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
