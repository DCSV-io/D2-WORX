import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Shared Postgres test helper for integration tests.
 * Manages Testcontainers lifecycle, Drizzle setup, and table cleanup.
 *
 * Can operate in two modes:
 *   1. **Container mode** — starts a new Testcontainers Postgres instance (default).
 *   2. **URI mode** — connects to an existing Postgres instance via `connectionUri`
 *      (used with globalSetup container reuse).
 */
export interface PostgresTestHelper {
  /** Start the container (or connect to existing URI) and run migrations. */
  start(): Promise<void>;
  /** Close the pool (and stop the container if we own it). */
  stop(): Promise<void>;
  /** Get the underlying pg.Pool. */
  getPool(): pg.Pool;
  /** Get the Drizzle database instance. */
  getDb(): NodePgDatabase;
  /** Get the connection URI. */
  getConnectionUri(): string;
  /** Execute a raw SQL statement (e.g., TRUNCATE). */
  clean(sql: string): Promise<void>;
}

export interface PostgresTestHelperOptions {
  /**
   * If provided, connect to this URI instead of starting a new container.
   * Migrations are assumed to have already run (globalSetup handles them).
   */
  connectionUri?: string;
}

/**
 * Factory function that creates a PostgresTestHelper.
 *
 * @param runMigrations - Service-specific migration function that receives a pg.Pool.
 * @param options - Optional configuration (e.g., pre-existing connection URI).
 */
export function createPostgresTestHelper(
  runMigrations: (pool: pg.Pool) => Promise<void>,
  options?: PostgresTestHelperOptions,
): PostgresTestHelper {
  let container: StartedPostgreSqlContainer | undefined;
  let pool: pg.Pool;
  let db: NodePgDatabase;
  let uri: string;

  return {
    async start() {
      if (options?.connectionUri) {
        // URI mode: connect to existing instance (globalSetup owns the container)
        uri = options.connectionUri;
        pool = new pg.Pool({ connectionString: uri });
        db = drizzle(pool);
        // Migrations already ran in globalSetup — skip
      } else {
        // Container mode: start a new Testcontainers instance
        container = await new PostgreSqlContainer("postgres:18").start();
        uri = container.getConnectionUri();
        pool = new pg.Pool({ connectionString: uri });
        db = drizzle(pool);
        await runMigrations(pool);
      }
    },

    async stop() {
      await pool?.end();
      if (container) {
        await container.stop();
      }
    },

    getPool() {
      return pool;
    },

    getDb() {
      return db;
    },

    getConnectionUri() {
      return uri;
    },

    async clean(sql: string) {
      await pool.query(sql);
    },
  };
}
