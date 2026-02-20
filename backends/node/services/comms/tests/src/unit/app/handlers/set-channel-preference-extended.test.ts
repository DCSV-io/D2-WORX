import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { SetChannelPreference } from "@d2/comms-app";
import { createChannelPreference } from "@d2/comms-domain";
import {
  createMockContext,
  createMockChannelPrefRepo,
} from "../helpers/mock-handlers.js";

const TEST_CONTACT_ID = "01961234-5678-7def-abcd-000000000002";

function createMockCache() {
  return {
    get: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })) },
    set: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })) },
  };
}

describe("SetChannelPreference — extended coverage", () => {
  it("should create preference via contactId path", async () => {
    const repo = createMockChannelPrefRepo();
    const handler = new SetChannelPreference(repo, createMockContext());

    const result = await handler.handleAsync({
      contactId: TEST_CONTACT_ID,
      emailEnabled: false,
      smsEnabled: true,
    });

    expect(result.success).toBe(true);
    expect(result.data!.pref.contactId).toBe(TEST_CONTACT_ID);
    expect(result.data!.pref.emailEnabled).toBe(false);
    expect(repo.findByContactId.handleAsync).toHaveBeenCalledWith({ contactId: TEST_CONTACT_ID });
    expect(repo.findByUserId.handleAsync).not.toHaveBeenCalled();
    expect(repo.create.handleAsync).toHaveBeenCalledOnce();
  });

  it("should update existing preference via contactId path", async () => {
    const existing = createChannelPreference({
      contactId: TEST_CONTACT_ID,
      emailEnabled: true,
      smsEnabled: true,
    });
    const repo = createMockChannelPrefRepo();
    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref: existing } }),
    );

    const handler = new SetChannelPreference(repo, createMockContext());
    const result = await handler.handleAsync({
      contactId: TEST_CONTACT_ID,
      smsEnabled: false,
    });

    expect(result.success).toBe(true);
    expect(result.data!.pref.smsEnabled).toBe(false);
    expect(result.data!.pref.emailEnabled).toBe(true);
    expect(repo.update.handleAsync).toHaveBeenCalledOnce();
  });

  it("should evict and repopulate cache with userId key", async () => {
    const cache = createMockCache();
    const repo = createMockChannelPrefRepo();
    const userId = "01961234-5678-7def-abcd-000000000003";
    const handler = new SetChannelPreference(repo, createMockContext(), cache as any);

    await handler.handleAsync({ userId, emailEnabled: true });

    expect(cache.set.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `chan-pref:user:${userId}`,
        expirationMs: 900_000,
      }),
    );
  });

  it("should evict and repopulate cache with contactId key", async () => {
    const cache = createMockCache();
    const repo = createMockChannelPrefRepo();
    const handler = new SetChannelPreference(repo, createMockContext(), cache as any);

    await handler.handleAsync({ contactId: TEST_CONTACT_ID, smsEnabled: false });

    expect(cache.set.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        key: `chan-pref:contact:${TEST_CONTACT_ID}`,
      }),
    );
  });

  it("should not call cache when cache not provided", async () => {
    const repo = createMockChannelPrefRepo();
    const handler = new SetChannelPreference(repo, createMockContext());
    const userId = "01961234-5678-7def-abcd-000000000004";

    const result = await handler.handleAsync({ userId, emailEnabled: true });

    expect(result.success).toBe(true);
    // No cache calls — handler created without cache
  });

  it("should set quiet hours fields", async () => {
    const repo = createMockChannelPrefRepo();
    const handler = new SetChannelPreference(repo, createMockContext());
    const userId = "01961234-5678-7def-abcd-000000000005";

    const result = await handler.handleAsync({
      userId,
      emailEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      quietHoursTz: "America/New_York",
    });

    expect(result.success).toBe(true);
    expect(result.data!.pref.quietHoursStart).toBe("22:00");
    expect(result.data!.pref.quietHoursEnd).toBe("08:00");
    expect(result.data!.pref.quietHoursTz).toBe("America/New_York");
  });

  it("should reject invalid quiet hours format", async () => {
    const repo = createMockChannelPrefRepo();
    const handler = new SetChannelPreference(repo, createMockContext());
    const userId = "01961234-5678-7def-abcd-000000000006";

    const result = await handler.handleAsync({
      userId,
      quietHoursStart: "25:00",
    });

    expect(result.success).toBe(false);
  });
});
