/**
 * Converts a .NET ADO.NET PostgreSQL connection string to a libpq URI.
 * Passes through strings that are already URIs (standalone / test mode).
 *
 * ADO.NET: `Host=host;Port=port;Username=user;Password=pass;Database=db`
 * URI:     `postgresql://user:pass@host:port/db`
 *
 * @example
 * ```ts
 * parsePostgresUrl("Host=db;Port=5432;Username=admin;Password=s3cr3t;Database=app");
 * // => "postgresql://admin:s3cr3t@db:5432/app"
 *
 * parsePostgresUrl("postgresql://admin:s3cr3t@db:5432/app");
 * // => "postgresql://admin:s3cr3t@db:5432/app" (pass-through)
 * ```
 */
export function parsePostgresUrl(connectionString: string): string {
  if (!connectionString.trim()) return "";

  if (connectionString.startsWith("postgresql://") || connectionString.startsWith("postgres://")) {
    return connectionString;
  }

  const params = new Map<string, string>();
  for (const part of connectionString.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
  }

  const host = params.get("host") ?? "localhost";
  const port = params.get("port") ?? "5432";
  const user = encodeURIComponent(params.get("username") ?? "postgres");
  const password = encodeURIComponent(params.get("password") ?? "");
  const database = params.get("database") ?? "";

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}
