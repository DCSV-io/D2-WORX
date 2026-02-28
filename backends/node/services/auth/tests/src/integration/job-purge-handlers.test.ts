import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { generateUuidV7 } from "@d2/utilities";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import {
  PurgeExpiredSessions,
  PurgeSignInEvents,
  PurgeExpiredInvitations,
  PurgeExpiredEmulationConsents,
  user,
  session,
  organization,
  invitation,
  signInEvent,
  emulationConsent,
} from "@d2/auth-infra";
import { startPostgres, stopPostgres, getDb, cleanAllTables } from "./postgres-test-helpers.js";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-purge-integration",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// PurgeExpiredSessions
// ---------------------------------------------------------------------------
describe("PurgeExpiredSessions (integration)", () => {
  let handler: PurgeExpiredSessions;
  const userId = generateUuidV7();

  beforeAll(async () => {
    await startPostgres();
    handler = new PurgeExpiredSessions(getDb(), createTestContext());

    // Seed a user (session FK requires it)
    await getDb().insert(user).values({
      id: userId,
      name: "Test User",
      email: "purge-sessions@test.com",
      emailVerified: false,
      username: "purge-sessions-user",
      displayUsername: "purge-sessions-user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    // Only truncate sessions, keep the user
    await getDb().delete(session);
  });

  it("should return 0 when no sessions exist", async () => {
    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(0);
  });

  it("should delete only expired sessions", async () => {
    await getDb()
      .insert(session)
      .values([
        {
          id: generateUuidV7(),
          userId,
          token: `tok-${generateUuidV7()}`,
          expiresAt: daysAgo(1),
          createdAt: daysAgo(8),
          updatedAt: daysAgo(8),
        },
        {
          id: generateUuidV7(),
          userId,
          token: `tok-${generateUuidV7()}`,
          expiresAt: daysAgo(3),
          createdAt: daysAgo(10),
          updatedAt: daysAgo(10),
        },
        {
          id: generateUuidV7(),
          userId,
          token: `tok-${generateUuidV7()}`,
          expiresAt: daysFromNow(5),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(2);

    const remaining = await getDb().select().from(session);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

// ---------------------------------------------------------------------------
// PurgeSignInEvents
// ---------------------------------------------------------------------------
describe("PurgeSignInEvents (integration)", () => {
  let handler: PurgeSignInEvents;

  beforeAll(async () => {
    await startPostgres();
    handler = new PurgeSignInEvents(getDb(), createTestContext());
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await getDb().delete(signInEvent);
  });

  it("should return 0 when no events exist", async () => {
    const result = await handler.handleAsync({ cutoffDate: new Date() });

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(0);
  });

  it("should delete events before cutoff and keep recent ones", async () => {
    const cutoff = daysAgo(90);

    await getDb()
      .insert(signInEvent)
      .values([
        {
          id: generateUuidV7(),
          userId: "user-1",
          successful: true,
          ipAddress: "127.0.0.1",
          userAgent: "test",
          createdAt: daysAgo(100),
        },
        {
          id: generateUuidV7(),
          userId: "user-1",
          successful: false,
          ipAddress: "10.0.0.1",
          userAgent: "test",
          createdAt: daysAgo(91),
        },
        {
          id: generateUuidV7(),
          userId: "user-1",
          successful: true,
          ipAddress: "192.168.1.1",
          userAgent: "test",
          createdAt: daysAgo(30),
        },
      ]);

    const result = await handler.handleAsync({ cutoffDate: cutoff });

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(2);

    const remaining = await getDb().select().from(signInEvent);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].createdAt.getTime()).toBeGreaterThan(cutoff.getTime());
  });
});

// ---------------------------------------------------------------------------
// PurgeExpiredInvitations
// ---------------------------------------------------------------------------
describe("PurgeExpiredInvitations (integration)", () => {
  let handler: PurgeExpiredInvitations;
  const userId = generateUuidV7();
  const orgId = generateUuidV7();

  beforeAll(async () => {
    await startPostgres();
    handler = new PurgeExpiredInvitations(getDb(), createTestContext());

    // Seed user and org (invitation FK constraints)
    await getDb().insert(user).values({
      id: userId,
      name: "Inviter",
      email: "inviter-purge@test.com",
      emailVerified: false,
      username: "inviter-purge",
      displayUsername: "inviter-purge",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await getDb().insert(organization).values({
      id: orgId,
      name: "Test Org",
      slug: "test-org-purge",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await getDb().delete(invitation);
  });

  it("should return 0 when no invitations exist", async () => {
    const result = await handler.handleAsync({ cutoffDate: new Date() });

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(0);
  });

  it("should delete only expired invitations before cutoff", async () => {
    const cutoff = daysAgo(7);

    await getDb()
      .insert(invitation)
      .values([
        // Expired long ago — should be purged
        {
          id: generateUuidV7(),
          organizationId: orgId,
          email: "old@test.com",
          role: "agent",
          status: "pending",
          expiresAt: daysAgo(10),
          inviterId: userId,
        },
        // Expired recently but before cutoff — should be purged
        {
          id: generateUuidV7(),
          organizationId: orgId,
          email: "recent-expired@test.com",
          role: "agent",
          status: "pending",
          expiresAt: daysAgo(8),
          inviterId: userId,
        },
        // Expired after cutoff — should NOT be purged
        {
          id: generateUuidV7(),
          organizationId: orgId,
          email: "borderline@test.com",
          role: "agent",
          status: "pending",
          expiresAt: daysAgo(5),
          inviterId: userId,
        },
        // Active invitation — should NOT be purged
        {
          id: generateUuidV7(),
          organizationId: orgId,
          email: "active@test.com",
          role: "agent",
          status: "pending",
          expiresAt: daysFromNow(7),
          inviterId: userId,
        },
      ]);

    const result = await handler.handleAsync({ cutoffDate: cutoff });

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(2);

    const remaining = await getDb().select().from(invitation);
    expect(remaining).toHaveLength(2);
  });

  it("should handle accepted invitations that expired before cutoff", async () => {
    const cutoff = daysAgo(7);

    await getDb()
      .insert(invitation)
      .values([
        {
          id: generateUuidV7(),
          organizationId: orgId,
          email: "accepted@test.com",
          role: "agent",
          status: "accepted",
          expiresAt: daysAgo(30),
          inviterId: userId,
        },
      ]);

    const result = await handler.handleAsync({ cutoffDate: cutoff });

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PurgeExpiredEmulationConsents
// ---------------------------------------------------------------------------
describe("PurgeExpiredEmulationConsents (integration)", () => {
  let handler: PurgeExpiredEmulationConsents;

  beforeAll(async () => {
    await startPostgres();
    handler = new PurgeExpiredEmulationConsents(getDb(), createTestContext());
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await getDb().delete(emulationConsent);
  });

  it("should return 0 when no consents exist", async () => {
    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(0);
  });

  it("should delete expired consents", async () => {
    await getDb()
      .insert(emulationConsent)
      .values([
        {
          id: generateUuidV7(),
          userId: "user-1",
          grantedToOrgId: "org-1",
          expiresAt: daysAgo(1),
          createdAt: daysAgo(30),
        },
        {
          id: generateUuidV7(),
          userId: "user-2",
          grantedToOrgId: "org-2",
          expiresAt: daysFromNow(30),
          createdAt: new Date(),
        },
      ]);

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(1);

    const remaining = await getDb().select().from(emulationConsent);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("should delete revoked consents regardless of expiry", async () => {
    await getDb()
      .insert(emulationConsent)
      .values([
        // Revoked but not yet expired — should be purged
        {
          id: generateUuidV7(),
          userId: "user-3",
          grantedToOrgId: "org-3",
          expiresAt: daysFromNow(30),
          revokedAt: daysAgo(1),
          createdAt: daysAgo(10),
        },
        // Active and not revoked — should NOT be purged
        {
          id: generateUuidV7(),
          userId: "user-4",
          grantedToOrgId: "org-4",
          expiresAt: daysFromNow(30),
          createdAt: new Date(),
        },
      ]);

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(1);

    const remaining = await getDb().select().from(emulationConsent);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].revokedAt).toBeNull();
  });

  it("should delete both expired and revoked in one pass", async () => {
    await getDb()
      .insert(emulationConsent)
      .values([
        // Expired
        {
          id: generateUuidV7(),
          userId: "user-5",
          grantedToOrgId: "org-5",
          expiresAt: daysAgo(5),
          createdAt: daysAgo(30),
        },
        // Revoked (not expired)
        {
          id: generateUuidV7(),
          userId: "user-6",
          grantedToOrgId: "org-6",
          expiresAt: daysFromNow(30),
          revokedAt: daysAgo(2),
          createdAt: daysAgo(10),
        },
        // Both expired AND revoked
        {
          id: generateUuidV7(),
          userId: "user-7",
          grantedToOrgId: "org-7",
          expiresAt: daysAgo(10),
          revokedAt: daysAgo(15),
          createdAt: daysAgo(30),
        },
        // Active — should NOT be purged
        {
          id: generateUuidV7(),
          userId: "user-8",
          grantedToOrgId: "org-8",
          expiresAt: daysFromNow(30),
          createdAt: new Date(),
        },
      ]);

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data?.rowsAffected).toBe(3);

    const remaining = await getDb().select().from(emulationConsent);
    expect(remaining).toHaveLength(1);
  });
});
