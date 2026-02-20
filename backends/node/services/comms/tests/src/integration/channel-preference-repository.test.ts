import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { generateUuidV7 } from "@d2/utilities";
import {
  createChannelPreference,
  updateChannelPreference,
  type ChannelPreference,
} from "@d2/comms-domain";
import { createChannelPreferenceRepoHandlers } from "@d2/comms-infra";
import type { ChannelPreferenceRepoHandlers } from "@d2/comms-app";
import {
  startPostgres,
  stopPostgres,
  getDb,
  cleanAllTables,
} from "./helpers/postgres-test-helpers.js";
import { createTestContext } from "./helpers/test-context.js";

describe("ChannelPreferenceRepository (integration)", () => {
  let repo: ChannelPreferenceRepoHandlers;

  beforeAll(async () => {
    await startPostgres();
    repo = createChannelPreferenceRepoHandlers(getDb(), createTestContext());
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanAllTables();
  });

  function makePref(overrides?: Partial<ChannelPreference>): ChannelPreference {
    const base = createChannelPreference({
      userId: generateUuidV7(),
    });
    return overrides ? { ...base, ...overrides } : base;
  }

  it("should create and find by userId", async () => {
    const pref = makePref();
    const createResult = await repo.create.handleAsync({ pref });
    expect(createResult.success).toBe(true);

    const findResult = await repo.findByUserId.handleAsync({ userId: pref.userId! });
    expect(findResult.success).toBe(true);

    const found = findResult.data!.pref!;
    expect(found.id).toBe(pref.id);
    expect(found.userId).toBe(pref.userId);
    expect(found.contactId).toBeNull();
    expect(found.emailEnabled).toBe(true);
    expect(found.smsEnabled).toBe(true);
    expect(found.quietHoursStart).toBeNull();
    expect(found.quietHoursEnd).toBeNull();
    expect(found.quietHoursTz).toBeNull();
    expect(found.createdAt).toBeInstanceOf(Date);
    expect(found.updatedAt).toBeInstanceOf(Date);
  });

  it("should create and find by contactId", async () => {
    const contactId = generateUuidV7();
    const pref = makePref({
      userId: null,
      contactId,
    });
    await repo.create.handleAsync({ pref });

    const result = await repo.findByContactId.handleAsync({ contactId });
    expect(result.success).toBe(true);
    expect(result.data!.pref).not.toBeNull();
    expect(result.data!.pref!.contactId).toBe(contactId);
  });

  it("should return null when userId not found", async () => {
    const result = await repo.findByUserId.handleAsync({ userId: "nonexistent" });
    expect(result.success).toBe(true);
    expect(result.data!.pref).toBeNull();
  });

  it("should return null when contactId not found", async () => {
    const result = await repo.findByContactId.handleAsync({ contactId: "nonexistent" });
    expect(result.success).toBe(true);
    expect(result.data!.pref).toBeNull();
  });

  it("should store quiet hours fields", async () => {
    const pref = createChannelPreference({
      userId: generateUuidV7(),
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      quietHoursTz: "America/New_York",
    });
    await repo.create.handleAsync({ pref });

    const result = await repo.findByUserId.handleAsync({ userId: pref.userId! });
    const found = result.data!.pref!;
    expect(found.quietHoursStart).toBe("22:00");
    expect(found.quietHoursEnd).toBe("07:00");
    expect(found.quietHoursTz).toBe("America/New_York");
  });

  it("should update preference fields", async () => {
    const pref = makePref();
    await repo.create.handleAsync({ pref });

    const updated = updateChannelPreference(pref, {
      emailEnabled: false,
      smsEnabled: false,
      quietHoursStart: "23:00",
      quietHoursEnd: "06:00",
      quietHoursTz: "Europe/London",
    });
    await repo.update.handleAsync({ pref: updated });

    const result = await repo.findByUserId.handleAsync({ userId: pref.userId! });
    const found = result.data!.pref!;
    expect(found.emailEnabled).toBe(false);
    expect(found.smsEnabled).toBe(false);
    expect(found.quietHoursStart).toBe("23:00");
    expect(found.quietHoursEnd).toBe("06:00");
    expect(found.quietHoursTz).toBe("Europe/London");
  });

  it("should enforce unique constraint on userId", async () => {
    const userId = generateUuidV7();
    const pref1 = makePref({ userId });
    const pref2 = makePref({ id: generateUuidV7(), userId });

    await repo.create.handleAsync({ pref: pref1 });
    const result = await repo.create.handleAsync({ pref: pref2 });
    expect(result.success).toBe(false);
  });

  it("should enforce unique constraint on contactId", async () => {
    const contactId = generateUuidV7();
    const pref1 = makePref({ userId: null, contactId });
    const pref2 = makePref({ id: generateUuidV7(), userId: null, contactId });

    await repo.create.handleAsync({ pref: pref1 });
    const result = await repo.create.handleAsync({ pref: pref2 });
    expect(result.success).toBe(false);
  });

  it("should not cross-contaminate between users", async () => {
    const userA = generateUuidV7();
    const userB = generateUuidV7();
    const prefA = makePref({ userId: userA, emailEnabled: false });
    const prefB = makePref({ id: generateUuidV7(), userId: userB, smsEnabled: false });

    await repo.create.handleAsync({ pref: prefA });
    await repo.create.handleAsync({ pref: prefB });

    const resultA = await repo.findByUserId.handleAsync({ userId: userA });
    const resultB = await repo.findByUserId.handleAsync({ userId: userB });
    expect(resultA.data!.pref!.emailEnabled).toBe(false);
    expect(resultA.data!.pref!.smsEnabled).toBe(true);
    expect(resultB.data!.pref!.emailEnabled).toBe(true);
    expect(resultB.data!.pref!.smsEnabled).toBe(false);
  });
});
