import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { generateUuidV7 } from "@d2/utilities";
import {
  SignInEventRepository,
  EmulationConsentRepository,
  OrgContactRepository,
} from "@d2/auth-infra";
import type { SignInEvent, EmulationConsent, OrgContact } from "@d2/auth-domain";
import {
  startPostgres,
  stopPostgres,
  getDb,
  cleanCustomTables,
} from "./postgres-test-helpers.js";

// ---------------------------------------------------------------------------
// SignInEventRepository
// ---------------------------------------------------------------------------
describe("SignInEventRepository (integration)", () => {
  let repo: SignInEventRepository;

  beforeAll(async () => {
    await startPostgres();
    repo = new SignInEventRepository(getDb());
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanCustomTables();
  });

  function makeEvent(overrides?: Partial<SignInEvent>): SignInEvent {
    return {
      id: generateUuidV7(),
      userId: "user-1",
      successful: true,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      whoIsId: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("should create and retrieve a sign-in event", async () => {
    const event = makeEvent();
    await repo.create(event);

    const results = await repo.findByUserId(event.userId, 10, 0);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(event.id);
    expect(results[0].userId).toBe(event.userId);
    expect(results[0].successful).toBe(true);
    expect(results[0].ipAddress).toBe("127.0.0.1");
    expect(results[0].userAgent).toBe("test-agent");
    expect(results[0].whoIsId).toBeNull();
  });

  it("should create an event with whoIsId", async () => {
    const event = makeEvent({ whoIsId: "abc123" });
    await repo.create(event);

    const results = await repo.findByUserId(event.userId, 10, 0);
    expect(results[0].whoIsId).toBe("abc123");
  });

  it("should return events ordered by created_at desc", async () => {
    const older = makeEvent({ createdAt: new Date("2025-01-01") });
    const newer = makeEvent({ createdAt: new Date("2025-06-01") });
    await repo.create(older);
    await repo.create(newer);

    const results = await repo.findByUserId("user-1", 10, 0);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(newer.id);
    expect(results[1].id).toBe(older.id);
  });

  it("should paginate with limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await repo.create(makeEvent({ createdAt: new Date(2025, 0, i + 1) }));
    }

    const page1 = await repo.findByUserId("user-1", 2, 0);
    const page2 = await repo.findByUserId("user-1", 2, 2);
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it("should count events by user", async () => {
    await repo.create(makeEvent());
    await repo.create(makeEvent());

    const count = await repo.countByUserId("user-1");
    expect(count).toBe(2);
  });

  it("should return 0 count for unknown user", async () => {
    const count = await repo.countByUserId("nonexistent");
    expect(count).toBe(0);
  });

  it("should return latest event date", async () => {
    const d1 = new Date("2025-01-01T00:00:00Z");
    const d2 = new Date("2025-06-15T00:00:00Z");
    await repo.create(makeEvent({ createdAt: d1 }));
    await repo.create(makeEvent({ createdAt: d2 }));

    const latest = await repo.getLatestEventDate("user-1");
    expect(latest).toBeInstanceOf(Date);
    expect(latest!.getTime()).toBe(d2.getTime());
  });

  it("should return null latest date for unknown user", async () => {
    const latest = await repo.getLatestEventDate("nonexistent");
    expect(latest).toBeNull();
  });

  it("should not cross-contaminate between users", async () => {
    await repo.create(makeEvent({ userId: "user-A" }));
    await repo.create(makeEvent({ userId: "user-B" }));

    const resultsA = await repo.findByUserId("user-A", 10, 0);
    const resultsB = await repo.findByUserId("user-B", 10, 0);
    expect(resultsA).toHaveLength(1);
    expect(resultsB).toHaveLength(1);
    expect(resultsA[0].userId).toBe("user-A");
    expect(resultsB[0].userId).toBe("user-B");
  });
});

// ---------------------------------------------------------------------------
// EmulationConsentRepository
// ---------------------------------------------------------------------------
describe("EmulationConsentRepository (integration)", () => {
  let repo: EmulationConsentRepository;

  beforeAll(async () => {
    await startPostgres();
    repo = new EmulationConsentRepository(getDb());
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanCustomTables();
  });

  function makeConsent(overrides?: Partial<EmulationConsent>): EmulationConsent {
    return {
      id: generateUuidV7(),
      userId: "user-1",
      grantedToOrgId: "org-1",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 day
      revokedAt: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("should create and retrieve a consent by id", async () => {
    const consent = makeConsent();
    await repo.create(consent);

    const found = await repo.findById(consent.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(consent.id);
    expect(found!.userId).toBe(consent.userId);
    expect(found!.grantedToOrgId).toBe(consent.grantedToOrgId);
    expect(found!.revokedAt).toBeNull();
  });

  it("should return undefined for nonexistent id", async () => {
    const found = await repo.findById("nonexistent");
    expect(found).toBeUndefined();
  });

  it("should find active consents by user", async () => {
    const active = makeConsent();
    const expired = makeConsent({
      id: generateUuidV7(),
      grantedToOrgId: "org-2",
      expiresAt: new Date(Date.now() - 1000), // already expired
    });
    const revoked = makeConsent({
      id: generateUuidV7(),
      grantedToOrgId: "org-3",
      revokedAt: new Date(),
    });

    await repo.create(active);
    await repo.create(expired);
    await repo.create(revoked);

    const results = await repo.findActiveByUserId("user-1");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(active.id);
  });

  it("should paginate active consents", async () => {
    for (let i = 0; i < 5; i++) {
      await repo.create(
        makeConsent({
          id: generateUuidV7(),
          grantedToOrgId: `org-${i}`,
          createdAt: new Date(2025, 0, i + 1),
        }),
      );
    }

    const page = await repo.findActiveByUserId("user-1", 2, 0);
    expect(page).toHaveLength(2);
  });

  it("should find active consent by user and org", async () => {
    const consent = makeConsent();
    await repo.create(consent);

    const found = await repo.findActiveByUserIdAndOrg("user-1", "org-1");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(consent.id);
  });

  it("should return null for nonexistent user+org combo", async () => {
    const found = await repo.findActiveByUserIdAndOrg("user-1", "org-999");
    expect(found).toBeNull();
  });

  it("should revoke a consent", async () => {
    const consent = makeConsent();
    await repo.create(consent);

    await repo.revoke(consent.id);

    const found = await repo.findById(consent.id);
    expect(found!.revokedAt).toBeInstanceOf(Date);

    const active = await repo.findActiveByUserId("user-1");
    expect(active).toHaveLength(0);
  });

  it("should enforce partial unique index on active consents", async () => {
    const consent1 = makeConsent();
    await repo.create(consent1);

    const consent2 = makeConsent({ id: generateUuidV7() }); // same user+org
    await expect(repo.create(consent2)).rejects.toThrow();
  });

  it("should allow duplicate user+org after revocation", async () => {
    const consent1 = makeConsent();
    await repo.create(consent1);
    await repo.revoke(consent1.id);

    const consent2 = makeConsent({ id: generateUuidV7() });
    await expect(repo.create(consent2)).resolves.not.toThrow();
  });

  it("should not cross-contaminate between users", async () => {
    await repo.create(makeConsent({ userId: "user-A" }));
    await repo.create(makeConsent({ id: generateUuidV7(), userId: "user-B" }));

    const resultsA = await repo.findActiveByUserId("user-A");
    const resultsB = await repo.findActiveByUserId("user-B");
    expect(resultsA).toHaveLength(1);
    expect(resultsB).toHaveLength(1);
    expect(resultsA[0].userId).toBe("user-A");
    expect(resultsB[0].userId).toBe("user-B");
  });
});

// ---------------------------------------------------------------------------
// OrgContactRepository
// ---------------------------------------------------------------------------
describe("OrgContactRepository (integration)", () => {
  let repo: OrgContactRepository;

  beforeAll(async () => {
    await startPostgres();
    repo = new OrgContactRepository(getDb());
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanCustomTables();
  });

  function makeContact(overrides?: Partial<OrgContact>): OrgContact {
    return {
      id: generateUuidV7(),
      organizationId: "org-1",
      label: "Main Office",
      isPrimary: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("should create and retrieve a contact by id", async () => {
    const contact = makeContact();
    await repo.create(contact);

    const found = await repo.findById(contact.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(contact.id);
    expect(found!.organizationId).toBe(contact.organizationId);
    expect(found!.label).toBe("Main Office");
    expect(found!.isPrimary).toBe(false);
  });

  it("should return undefined for nonexistent id", async () => {
    const found = await repo.findById("nonexistent");
    expect(found).toBeUndefined();
  });

  it("should find contacts by org with primary first", async () => {
    const secondary = makeContact({
      label: "Branch",
      isPrimary: false,
      createdAt: new Date("2025-01-01"),
    });
    const primary = makeContact({
      id: generateUuidV7(),
      label: "HQ",
      isPrimary: true,
      createdAt: new Date("2025-06-01"),
    });

    await repo.create(secondary);
    await repo.create(primary);

    const results = await repo.findByOrgId("org-1");
    expect(results).toHaveLength(2);
    expect(results[0].isPrimary).toBe(true);
    expect(results[0].label).toBe("HQ");
    expect(results[1].isPrimary).toBe(false);
  });

  it("should paginate contacts by org", async () => {
    for (let i = 0; i < 5; i++) {
      await repo.create(
        makeContact({
          id: generateUuidV7(),
          label: `Contact ${i}`,
          createdAt: new Date(2025, 0, i + 1),
        }),
      );
    }

    const page = await repo.findByOrgId("org-1", 2, 0);
    expect(page).toHaveLength(2);
  });

  it("should update label and isPrimary", async () => {
    const contact = makeContact();
    await repo.create(contact);

    const updated: OrgContact = {
      ...contact,
      label: "Updated Office",
      isPrimary: true,
      updatedAt: new Date(),
    };
    await repo.update(updated);

    const found = await repo.findById(contact.id);
    expect(found!.label).toBe("Updated Office");
    expect(found!.isPrimary).toBe(true);
    expect(found!.organizationId).toBe(contact.organizationId);
  });

  it("should delete a contact", async () => {
    const contact = makeContact();
    await repo.create(contact);

    await repo.delete(contact.id);

    const found = await repo.findById(contact.id);
    expect(found).toBeUndefined();
  });

  it("should not cross-contaminate between orgs", async () => {
    await repo.create(makeContact({ organizationId: "org-A" }));
    await repo.create(makeContact({ id: generateUuidV7(), organizationId: "org-B" }));

    const resultsA = await repo.findByOrgId("org-A");
    const resultsB = await repo.findByOrgId("org-B");
    expect(resultsA).toHaveLength(1);
    expect(resultsB).toHaveLength(1);
    expect(resultsA[0].organizationId).toBe("org-A");
    expect(resultsB[0].organizationId).toBe("org-B");
  });
});
