import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { runMigrations } from "@d2/comms-infra";

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

export async function cleanAllTables(): Promise<void> {
  await pool.query(
    "TRUNCATE delivery_attempt, delivery_request, message, channel_preference CASCADE",
  );
}
