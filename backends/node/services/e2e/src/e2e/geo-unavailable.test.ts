import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startContainers,
  stopContainers,
  getAuthPgUrl,
  getRedisUrl,
  getRabbitUrl,
} from "../helpers/containers.js";
import {
  startAuthService,
  stopAuthService,
  type AuthServiceHandle,
} from "../helpers/auth-service.js";

/**
 * E2E negative-path test: Auth sign-up when the Geo service is unreachable.
 *
 * Architecture decision: "Geo unavailable: Fail sign-up entirely (no stale users)"
 * — a user cannot be created if the prerequisite contact cannot be created in Geo.
 *
 * This test starts Auth pointing to a non-existent Geo address (localhost:1)
 * and verifies sign-up fails gracefully rather than creating an orphaned user.
 */
describe("E2E: Auth sign-up with Geo unavailable", () => {
  let authHandle: AuthServiceHandle;

  beforeAll(async () => {
    // Start only PG + Redis + RabbitMQ — no Geo service
    await startContainers();

    // Start auth service pointing to a bogus Geo address
    authHandle = await startAuthService({
      databaseUrl: getAuthPgUrl(),
      redisUrl: getRedisUrl(),
      rabbitMqUrl: getRabbitUrl(),
      geoAddress: "localhost:1", // unreachable
      geoApiKey: "e2e-test-key",
    });
  }, 180_000);

  afterAll(async () => {
    await stopAuthService();
    await stopContainers();
  });

  it("should fail sign-up when Geo service is unreachable", async () => {
    const email = "geo-down-e2e@example.com";
    const name = "Geo Down E2E";
    const password = "SecurePass123!@#";

    // Sign-up should fail because createUserContact (BetterAuth hook) cannot
    // reach the Geo gRPC service to create the prerequisite contact.
    let signUpError: unknown;
    try {
      await authHandle.auth.api.signUpEmail({
        body: { email, password, name },
      });
    } catch (err) {
      signUpError = err;
    }

    // The sign-up must fail — no orphaned user without a Geo contact
    expect(signUpError).toBeDefined();
  });

  it("should not create a user record when Geo is down", async () => {
    const email = "geo-down-no-user@example.com";
    const name = "No User Created";
    const password = "SecurePass123!@#";

    // Attempt sign-up (expected to fail)
    try {
      await authHandle.auth.api.signUpEmail({
        body: { email, password, name },
      });
    } catch {
      // Expected
    }

    // Verify no user was created with this email
    // Use the auth API to check — signInEmail should fail with "not found"
    let signInError: unknown;
    try {
      await authHandle.auth.api.signInEmail({
        body: { email, password },
      });
    } catch (err) {
      signInError = err;
    }

    expect(signInError).toBeDefined();
  });
});
