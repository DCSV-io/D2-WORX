import type { ILogger } from "@d2/logging";
import type { FindWhoIs } from "@d2/geo-client";
import { resolveIp, isLocalhost } from "./ip-resolver.js";
import { buildServerFingerprint } from "./fingerprint-builder.js";
import { RequestInfo } from "./request-info.js";
import {
  DEFAULT_REQUEST_ENRICHMENT_OPTIONS,
  type RequestEnrichmentOptions,
} from "./request-enrichment-options.js";
import type { RequestEnrichment } from "@d2/interfaces";

/**
 * Enriches an HTTP request with client information.
 * Framework-agnostic — takes a plain headers object.
 * Mirrors the logic of D2.Shared.RequestEnrichment.Default.RequestEnrichmentMiddleware in .NET.
 *
 * Always succeeds — never throws. Fail-open on WhoIs errors.
 *
 * @param headers - Plain headers object (lowercase keys).
 * @param findWhoIs - The FindWhoIs handler from @d2/geo-client.
 * @param options - Optional partial options (merged with defaults).
 * @param logger - Optional logger for diagnostic output.
 */
export async function enrichRequest(
  headers: Record<string, string | string[] | undefined>,
  findWhoIs: FindWhoIs,
  options?: Partial<RequestEnrichmentOptions>,
  logger?: ILogger,
): Promise<RequestEnrichment.IRequestInfo> {
  const opts = { ...DEFAULT_REQUEST_ENRICHMENT_OPTIONS, ...options };

  // 1. Resolve client IP (only trusting configured proxy headers).
  const clientIp = resolveIp(headers, opts.trustedProxyHeaders, opts.maxForwardedForLength);

  // 2. Compute server fingerprint.
  const serverFingerprint = buildServerFingerprint(headers);

  // 3. Read client fingerprint from configured header (truncate oversized values).
  const clientFingerprintRaw = headers[opts.clientFingerprintHeader];
  let clientFingerprint = clientFingerprintRaw
    ? Array.isArray(clientFingerprintRaw)
      ? clientFingerprintRaw[0]
      : clientFingerprintRaw
    : undefined;
  if (clientFingerprint && clientFingerprint.length > opts.maxFingerprintLength) {
    clientFingerprint = clientFingerprint.slice(0, opts.maxFingerprintLength);
  }

  // 4. Build initial request info (without WhoIs data).
  let requestInfo: RequestEnrichment.IRequestInfo = new RequestInfo({
    clientIp,
    serverFingerprint,
    clientFingerprint,
  });

  // 5. Perform WhoIs lookup if enabled and not localhost.
  if (opts.enableWhoIsLookup && !isLocalhost(clientIp)) {
    try {
      const userAgent = headers["user-agent"];
      const fingerprint = Array.isArray(userAgent) ? (userAgent[0] ?? "") : (userAgent ?? "");

      const whoIsResult = await findWhoIs.handleAsync({
        ipAddress: clientIp,
        fingerprint,
      });

      const output = whoIsResult.checkSuccess();
      if (output?.whoIs) {
        const whoIs = output.whoIs;
        requestInfo = new RequestInfo({
          clientIp,
          serverFingerprint,
          clientFingerprint,
          whoIsHashId: whoIs.hashId || undefined,
          city: whoIs.location?.city || undefined,
          countryCode: whoIs.location?.countryIso31661Alpha2Code || undefined,
          subdivisionCode: whoIs.location?.subdivisionIso31662Code || undefined,
          isVpn: whoIs.isVpn,
          isProxy: whoIs.isProxy,
          isTor: whoIs.isTor,
          isHosting: whoIs.isHosting,
        });

        logger?.debug(
          `Enriched request from IP ${clientIp} with WhoIs data. City: ${whoIs.location?.city}, Country: ${whoIs.location?.countryIso31661Alpha2Code}`,
        );
      } else {
        logger?.debug(`WhoIs lookup for IP ${clientIp} returned no data`);
      }
    } catch {
      // Fail-open: log warning and continue without WhoIs data.
      logger?.warn(`WhoIs lookup failed for IP ${clientIp}. Proceeding without WhoIs data.`);
    }
  }

  return requestInfo;
}
