/**
 * Header key constants.
 */
const CF_CONNECTING_IP = "cf-connecting-ip";
const X_REAL_IP = "x-real-ip";
const X_FORWARDED_FOR = "x-forwarded-for";

/**
 * Extracts the first non-empty value from a header that may be a string or string array.
 */
function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = headers[key];
  if (value === undefined) return undefined;
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.trim() !== "" ? first.trim() : undefined;
}

/**
 * Resolves the client IP address from HTTP headers.
 * Mirrors D2.Shared.RequestEnrichment.Default.IpResolver.Resolve in .NET.
 *
 * Priority:
 * 1. CF-Connecting-IP (Cloudflare)
 * 2. X-Real-IP (Nginx/reverse proxy)
 * 3. X-Forwarded-For (first entry)
 * 4. Fallback to "unknown"
 *
 * @param headers - Plain headers object (framework-agnostic, lowercase keys).
 */
export function resolveIp(headers: Record<string, string | string[] | undefined>): string {
  // 1. Cloudflare header
  const cfIp = getHeaderValue(headers, CF_CONNECTING_IP);
  if (cfIp) return cfIp;

  // 2. X-Real-IP
  const realIp = getHeaderValue(headers, X_REAL_IP);
  if (realIp) return realIp;

  // 3. X-Forwarded-For (first entry from comma-separated list)
  const forwarded = getHeaderValue(headers, X_FORWARDED_FOR);
  if (forwarded) {
    const parts = forwarded.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed !== "") return trimmed;
    }
  }

  // 4. Fallback
  return "unknown";
}

/**
 * Determines whether the IP address is a localhost/loopback address.
 * Mirrors D2.Shared.RequestEnrichment.Default.IpResolver.IsLocalhost in .NET.
 */
export function isLocalhost(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";
}
