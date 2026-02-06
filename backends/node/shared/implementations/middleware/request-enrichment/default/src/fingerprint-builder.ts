import { createHash } from "node:crypto";

/**
 * Extracts the first value from a header that may be a string or string array.
 */
function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = headers[key];
  if (value === undefined) return "";
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

/**
 * Builds a server-side fingerprint from request headers.
 * Mirrors D2.Shared.RequestEnrichment.Default.FingerprintBuilder.Build in .NET.
 *
 * The fingerprint is SHA-256("{user-agent}|{accept-language}|{accept-encoding}|{accept}"),
 * returned as a 64-character lowercase hex string.
 *
 * @param headers - Plain headers object (framework-agnostic, lowercase keys).
 */
export function buildServerFingerprint(
  headers: Record<string, string | string[] | undefined>,
): string {
  const userAgent = getHeaderValue(headers, "user-agent");
  const acceptLanguage = getHeaderValue(headers, "accept-language");
  const acceptEncoding = getHeaderValue(headers, "accept-encoding");
  const accept = getHeaderValue(headers, "accept");

  const input = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${accept}`;

  return createHash("sha256").update(input, "utf8").digest("hex");
}
