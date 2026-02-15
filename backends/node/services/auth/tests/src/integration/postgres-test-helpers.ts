import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { runMigrations } from "@d2/auth-infra";

let container: StartedPostgreSqlContainer;
let pool: pg.Pool;
let db: NodePgDatabase;

export async function startPostgres(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:18").start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool);
  await runMigrations(pool);
}

export async function stopPostgres(): Promise<void> {
  await pool?.end();
  await container?.stop();
}

export function getPool(): pg.Pool {
  return pool;
}

export function getDb(): NodePgDatabase {
  return db;
}

export function getConnectionUri(): string {
  return container.getConnectionUri();
}

export async function cleanCustomTables(): Promise<void> {
  await pool.query("TRUNCATE sign_in_event, emulation_consent, org_contact CASCADE");
}

export async function cleanAllTables(): Promise<void> {
  // All tables (BetterAuth + custom) are created by Drizzle migration.
  // Order matters: child tables (with FKs) before parent tables, or use CASCADE.
  await pool.query(
    `TRUNCATE "invitation", "member", "session", "account", "verification", "jwks",
              "organization", "user",
              sign_in_event, emulation_consent, org_contact
     CASCADE`,
  );
}
