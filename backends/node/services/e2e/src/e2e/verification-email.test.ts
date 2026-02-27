import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startContainers,
  stopContainers,
  getAuthPgUrl,
  getCommsPgUrl,
  getGeoPgUrl,
  getRedisUrl,
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

describe("E2E: Auth sign-up → verification email delivery", () => {
  let geoAddress: string;
  let authHandle: AuthServiceHandle;
  let commsHandle: CommsServiceHandle;

  beforeAll(async () => {
    // 1. Start infrastructure containers (PG + RabbitMQ + Redis)
    await startContainers();

    // 2. Start .NET Geo service
    geoAddress = await startGeoService({
      pgUrl: getGeoPgUrl(),
      redisUrl: getRedisUrl(),
      rabbitUrl: getRabbitUrl(),
      apiKey: GEO_API_KEY,
    });

    // 3. Start auth service (in-process)
    authHandle = await startAuthService({
      databaseUrl: getAuthPgUrl(),
      redisUrl: getRedisUrl(),
      rabbitMqUrl: getRabbitUrl(),
      geoAddress,
      geoApiKey: GEO_API_KEY,
    });

    // 4. Start comms service (in-process with stub email)
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

  it("should deliver a verification email when a user signs up", async () => {
    const email = "verify-e2e@example.com";
    const name = "Verify E2E";
    const password = "SecurePass123!@#";

    // Sign up — this should:
    // 1. Create Geo contact (via createUserContact hook)
    // 2. Create BetterAuth user
    // 3. Publish verification notification to RabbitMQ via @d2/comms-client
    // 4. Comms consumer picks up → Deliver → StubEmailProvider captures email
    const signUpRes = await authHandle.auth.api.signUpEmail({
      body: { email, password, name },
    });

    expect(signUpRes.user).toBeDefined();
    expect(signUpRes.user.email).toBe(email);

    // Wait for comms to process the event and deliver the email
    await waitFor(async () => commsHandle.stubEmail.sentCount() >= 1, {
      timeout: 15_000,
      label: "verification email delivery",
    });

    // Assert: stub captured the email
    expect(commsHandle.stubEmail.sentCount()).toBeGreaterThanOrEqual(1);

    const sentEmail = commsHandle.stubEmail.getLastEmail();
    expect(sentEmail).toBeDefined();
    expect(sentEmail!.to).toBe(email);
    expect(sentEmail!.subject.toLowerCase()).toContain("verify");

    // Assert: delivery records exist in comms DB (recipient_contact_id, not userId)
    const deliveryRequests = await getCommsPool().query(
      "SELECT * FROM delivery_request ORDER BY created_at DESC",
    );
    expect(deliveryRequests.rows.length).toBeGreaterThanOrEqual(1);
    expect(deliveryRequests.rows[0].recipient_contact_id).toBeDefined();

    const requestId = deliveryRequests.rows[0].id;
    const attempts = await getCommsPool().query(
      "SELECT * FROM delivery_attempt WHERE request_id = $1",
      [requestId],
    );
    expect(attempts.rows.length).toBeGreaterThanOrEqual(1);
    expect(attempts.rows[0].channel).toBe("email");
    expect(attempts.rows[0].status).toBe("sent");
  });

  it("should be idempotent — same correlationId produces same result", async () => {
    const email = "idempotent-e2e@example.com";
    const name = "Idempotent E2E";
    const password = "SecurePass123!@#";

    const initialCount = commsHandle.stubEmail.sentCount();

    // Sign up
    await authHandle.auth.api.signUpEmail({
      body: { email, password, name },
    });

    // Wait for first delivery
    await waitFor(async () => commsHandle.stubEmail.sentCount() > initialCount, {
      timeout: 15_000,
      label: "idempotent first delivery",
    });

    const countAfterFirst = commsHandle.stubEmail.sentCount();

    // Small delay to ensure no duplicate processing
    await new Promise((r) => setTimeout(r, 2_000));

    // Verify no additional emails were sent (correlationId dedup in Deliver handler)
    expect(commsHandle.stubEmail.sentCount()).toBe(countAfterFirst);
  });
});
