/**
 * Shared helpers for Tier 2 browser E2E tests.
 *
 * These utilities require infrastructure to be running (started by global-setup).
 * Environment variables (AUTH_DB_URL, AUTH_BASE_URL) are set in global-setup
 * and propagated to Playwright worker processes.
 */
import pg from "pg";

/**
 * Marks a user's email as verified directly in the auth database.
 *
 * BetterAuth enforces `requireEmailVerification: true`, so users created
 * via the API have `emailVerified = false` and cannot sign in. This helper
 * bypasses the email verification flow for test setup (same pattern as
 * the Vitest E2E tests in `e2e/password-reset.test.ts`).
 */
export async function verifyUserEmail(email: string): Promise<void> {
  const dbUrl = process.env.AUTH_DB_URL;
  if (!dbUrl) throw new Error("AUTH_DB_URL not set — global-setup may have failed");

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('UPDATE "user" SET email_verified = true WHERE email = $1', [email]);
  } finally {
    await client.end();
  }
}
