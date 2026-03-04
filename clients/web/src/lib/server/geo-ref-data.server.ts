/**
 * Convenience helper for accessing geo reference data.
 *
 * Uses the geo-client's 4-tier cache (Memory → Redis → Disk → gRPC).
 * After the first successful call the data stays in memory — subsequent
 * calls are effectively free.
 *
 * Returns `null` if the data is unavailable (e.g. infrastructure not running).
 */
import type { GeoRefData } from "@d2/protos";
import { getMiddlewareContext } from "./middleware.server.js";

/** Get geo reference data (memory-cached after first call). */
export async function getGeoRefData(): Promise<GeoRefData | null> {
  const ctx = getMiddlewareContext();
  if (!ctx) return null;
  const result = await ctx.getGeoRefData.handleAsync({});
  return result.checkSuccess()?.data ?? null;
}
