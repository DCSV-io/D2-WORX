import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startContainers,
  stopContainers,
  getAuthPgUrl,
  getCommsPgUrl,
  getGeoPgUrl,
  getRedisUrl,
  getAuthPool,
  getCommsPool,
  getRabbitUrl,
} from "../helpers/containers.js";
import { startGeoService, stopGeoService } from "../helpers/geo-dotnet-service.js";
import {
  startAuthService,
  stopAuthService,
  type AuthServiceHandle,
} from "../helpers/auth-service.js";
import {
  startCommsService,
  stopCommsService,
  type CommsServiceHandle,
} from "../helpers/comms-service.js";
import { waitFor } from "../helpers/wait.js";

const GEO_API_KEY = "e2e-test-key";

describe("E2E: Password reset → reset email delivery", () => {
  let geoAddress: string;
  let authHandle: AuthServiceHandle;
  let commsHandle: CommsServiceHandle;

  beforeAll(async () => {
    await startContainers();

    geoAddress = await startGeoService({
      pgUrl: getGeoPgUrl(),
      redisUrl: getRedisUrl(),
      rabbitUrl: getRabbitUrl(),
      apiKey: GEO_API_KEY,
    });

    authHandle = await startAuthService({
      databaseUrl: getAuthPgUrl(),
      redisUrl: getRedisUrl(),
      rabbitMqUrl: getRabbitUrl(),
      geoAddress,
      geoApiKey: GEO_API_KEY,
    });

    commsHandle = await startCommsService({
      databaseUrl: getCommsPgUrl(),
      rabbitMqUrl: getRabbitUrl(),
      geoAddress,
      geoApiKey: GEO_API_KEY,
    });
  }, 180_000);

  afterAll(async () => {
    await stopCommsService();
    await stopAuthService();
    await stopGeoService();
    await stopContainers();
  });

  it("should deliver a password reset email when requestPasswordReset is called", async () => {
    const email = "reset-e2e@example.com";
    const name = "Reset E2E";
    const password = "SecurePass123!@#";

    // Step 1: Sign up
    const signUpRes = await authHandle.auth.api.signUpEmail({
      body: { email, password, name },
    });

    // Wait for verification email first
    await waitFor(async () => commsHandle.stubEmail.sentCount() >= 1, {
      timeout: 15_000,
      label: "verification email",
    });

    // Step 2: Manually verify email
    await getAuthPool().query('UPDATE "user" SET email_verified = true WHERE id = $1', [
      signUpRes.user.id,
    ]);

    const beforeResetCount = commsHandle.stubEmail.sentCount();

    // Step 3: Request password reset
    await authHandle.auth.api.requestPasswordReset({
      body: { email, redirectTo: "http://localhost:5173/reset" },
    });

    // Step 4: Wait for comms to process the password reset event
    await waitFor(async () => commsHandle.stubEmail.sentCount() > beforeResetCount, {
      timeout: 15_000,
      label: "password reset email delivery",
    });

    // Assert: the last email is the password reset
    const sentEmail = commsHandle.stubEmail.getLastEmail();
    expect(sentEmail).toBeDefined();
    expect(sentEmail!.to).toBe(email);
    expect(sentEmail!.subject.toLowerCase()).toContain("reset");

    // Assert: delivery records exist in comms DB
    const requests = await getCommsPool().query(
      "SELECT * FROM delivery_request WHERE recipient_user_id = $1 ORDER BY created_at DESC",
      [signUpRes.user.id],
    );
    // Should have at least 2 requests: verification + password reset
    expect(requests.rows.length).toBeGreaterThanOrEqual(2);
  });
});
