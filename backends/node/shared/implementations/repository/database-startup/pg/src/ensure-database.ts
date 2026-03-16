import pg from "pg";

/**
 * Ensures the target database exists by connecting to the `postgres` default
 * database and issuing CREATE DATABASE IF NOT EXISTS. Idempotent — safe to
 * call on every startup.
 */
export async function ensureDatabase(
  databaseUrl: string,
  logger?: { info: (msg: string) => void },
): Promise<void> {
  // Parse the database name from the connection string URI
  // Format: postgresql://user:pass@host:port/dbname
  const url = new URL(databaseUrl);
  const dbName = url.pathname.slice(1); // remove leading "/"

  if (!dbName) {
    throw new Error("ensureDatabase: no database name found in connection URL");
  }

  // Connect to the default 'postgres' database
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";

  const adminPool = new pg.Pool({ connectionString: adminUrl.toString() });

  try {
    // Check if database exists first (CREATE DATABASE IF NOT EXISTS is not valid PG SQL)
    const result = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);

    if (result.rowCount === 0) {
      // Database names can't be parameterized in CREATE DATABASE, but we control the value
      // (it comes from our own env config, not user input)
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      logger?.info(`Created database "${dbName}"`);
    } else {
      logger?.info(`Database "${dbName}" already exists`);
    }
  } finally {
    await adminPool.end();
  }
}
