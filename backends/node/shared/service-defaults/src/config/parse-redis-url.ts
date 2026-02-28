/**
 * Converts a .NET StackExchange.Redis connection string to a Redis URI.
 * Passes through strings that are already URIs (standalone / test mode).
 *
 * StackExchange: `host:port,password=pass`
 * URI:           `redis://:pass@host:port`
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

  const [hostPort = "", ...options] = input.split(",");
  const params = new Map<string, string>();
  for (const opt of options) {
    const eq = opt.indexOf("=");
    if (eq === -1) continue;
    params.set(opt.slice(0, eq).trim().toLowerCase(), opt.slice(eq + 1).trim());
  }

  const password = params.get("password");
  const [host, port] = hostPort.includes(":") ? hostPort.split(":") : [hostPort, "6379"];

  return password
    ? `redis://:${encodeURIComponent(password)}@${host}:${port}`
    : `redis://${host}:${port}`;
}
