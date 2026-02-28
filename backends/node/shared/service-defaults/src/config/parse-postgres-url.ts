/**
 * Converts a .NET ADO.NET PostgreSQL connection string to a libpq URI.
 * Passes through strings that are already URIs (standalone / test mode).
 *
 * ADO.NET: `Host=host;Port=port;Username=user;Password=pass;Database=db`
 * URI:     `postgresql://user:pass@host:port/db`
 *
 * Supports Npgsql's single-quote convention for values containing semicolons:
 * `Password='p;a;ss'` → password is `p;a;ss`. Doubled quotes (`''`) inside a
 * quoted value represent a literal single quote.
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
  const input = connectionString.trim();
  if (!input) return "";

  if (input.startsWith("postgresql://") || input.startsWith("postgres://")) {
    return input;
  }

  const params = parseAdoNetPairs(input);

  const host = params.get("host") ?? "localhost";
  const port = params.get("port") ?? "5432";
  const user = encodeURIComponent(params.get("username") ?? "postgres");
  const password = encodeURIComponent(params.get("password") ?? "");
  const database = params.get("database") ?? "";

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * Parses ADO.NET-style `Key=Value;Key2=Value2` pairs, respecting Npgsql's
 * single-quote convention: `Key='val;ue'` keeps the semicolon in the value.
 * Doubled single quotes (`''`) inside a quoted value become a literal `'`.
 */
function parseAdoNetPairs(input: string): Map<string, string> {
  const params = new Map<string, string>();
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Skip whitespace before key
    while (i < len && input[i] === " ") i++;

    // Find '='
    const eqIdx = input.indexOf("=", i);
    if (eqIdx === -1) break;

    const key = input.slice(i, eqIdx).trim().toLowerCase();
    i = eqIdx + 1;

    // Skip whitespace before value
    while (i < len && input[i] === " ") i++;

    let value: string;
    if (i < len && input[i] === "'") {
      // Quoted value — read until closing quote ('' = escaped quote)
      i++; // skip opening quote
      let buf = "";
      while (i < len) {
        if (input[i] === "'") {
          if (i + 1 < len && input[i + 1] === "'") {
            buf += "'";
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          buf += input[i];
          i++;
        }
      }
      value = buf;
      // Skip to next ';' or end
      while (i < len && input[i] !== ";") i++;
    } else {
      // Unquoted value — read until ';' or end
      const semi = input.indexOf(";", i);
      if (semi === -1) {
        value = input.slice(i).trim();
        i = len;
      } else {
        value = input.slice(i, semi).trim();
        i = semi;
      }
    }

    if (key) params.set(key, value);

    // Skip the ';'
    if (i < len && input[i] === ";") i++;
  }

  return params;
}
