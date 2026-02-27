import { createPostgresTestHelper, type PostgresTestHelper } from "@d2/testing";
import { runMigrations } from "@d2/auth-infra";

const helper: PostgresTestHelper = createPostgresTestHelper(runMigrations);

export async function startPostgres(): Promise<void> {
  await helper.start();
}

export async function stopPostgres(): Promise<void> {
  await helper.stop();
}

export function getPool() {
  return helper.getPool();
}

export function getDb() {
  return helper.getDb();
}

export function getConnectionUri(): string {
  return helper.getConnectionUri();
}

export async function cleanCustomTables(): Promise<void> {
  await helper.clean("TRUNCATE sign_in_event, emulation_consent, org_contact CASCADE");
}

export async function cleanAllTables(): Promise<void> {
  await helper.clean(
    `TRUNCATE "invitation", "member", "session", "account", "verification", "jwks",
              "organization", "user",
              sign_in_event, emulation_consent, org_contact
     CASCADE`,
  );
}
