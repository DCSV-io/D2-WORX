/**
 * Converts a .NET StackExchange.Redis connection string to a Redis URI.
 * Passes through strings that are already URIs (standalone / test mode).
 *
 * StackExchange: `host:port,password=pass`
 * URI:           `redis://:pass@host:port`
 *
 * **Limitations:** Passwords containing commas are not supported — this matches
 * StackExchange.Redis itself, which uses commas as option delimiters without an
 * escape mechanism. Extra StackExchange options (ssl, abortConnect, etc.) are
 * silently ignored; only `password` is extracted.
 *
 * @example
 * ```ts
 * parseRedisUrl("redis-host:6380,password=s3cr3t");
 * // => "redis://:s3cr3t@redis-host:6380"
 *
 * parseRedisUrl("redis://localhost:6379");
 * // => "redis://localhost:6379" (pass-through)
 * ```
 */
export function parseRedisUrl(connectionString: string): string {
  const input = connectionString.trim();
  if (!input) return "";

  if (input.startsWith("redis://") || input.startsWith("rediss://")) {
    return input;
  }

  const [rawHostPort = "", ...options] = input.split(",");
  const hostPort = rawHostPort.trim();
  const params = new Map<string, string>();
  for (const opt of options) {
    const eq = opt.indexOf("=");
    if (eq === -1) continue;
    params.set(opt.slice(0, eq).trim().toLowerCase(), opt.slice(eq + 1).trim());
  }

  const password = params.get("password");
  const lastColon = hostPort.lastIndexOf(":");
  const [host, port] =
    lastColon !== -1
      ? [hostPort.slice(0, lastColon), hostPort.slice(lastColon + 1) || "6379"]
      : [hostPort, "6379"];

  return password
    ? `redis://:${encodeURIComponent(password)}@${host}:${port}`
    : `redis://${host}:${port}`;
}
