import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { GetChannelPreference } from "@d2/comms-app";
import { createChannelPreference } from "@d2/comms-domain";
import {
  createMockContext,
  createMockChannelPrefRepo,
} from "../helpers/mock-handlers.js";

function createMockCache() {
  return {
    get: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })) },
    set: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })) },
  };
}

describe("GetChannelPreference", () => {
  it("should return null when neither userId nor contactId provided", async () => {
    const repo = createMockChannelPrefRepo();
    const handler = new GetChannelPreference(repo, createMockContext());

    const result = await handler.handleAsync({});

    expect(result.success).toBe(true);
    expect(result.data!.pref).toBeNull();
    expect(repo.findByUserId.handleAsync).not.toHaveBeenCalled();
    expect(repo.findByContactId.handleAsync).not.toHaveBeenCalled();
  });

  it("should fetch by userId from repo when no cache", async () => {
    const pref = createChannelPreference({ userId: "user-1", emailEnabled: true, smsEnabled: false });
    const repo = createMockChannelPrefRepo();
    (repo.findByUserId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref } }),
    );

    const handler = new GetChannelPreference(repo, createMockContext());
    const result = await handler.handleAsync({ userId: "user-1" });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toEqual(pref);
    expect(repo.findByUserId.handleAsync).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("should fetch by contactId from repo when no cache", async () => {
    const pref = createChannelPreference({ contactId: "contact-1", emailEnabled: false });
    const repo = createMockChannelPrefRepo();
    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref } }),
    );

    const handler = new GetChannelPreference(repo, createMockContext());
    const result = await handler.handleAsync({ contactId: "contact-1" });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toEqual(pref);
    expect(repo.findByContactId.handleAsync).toHaveBeenCalledWith({ contactId: "contact-1" });
    expect(repo.findByUserId.handleAsync).not.toHaveBeenCalled();
  });

  it("should return null when repo finds nothing", async () => {
    const repo = createMockChannelPrefRepo();
    const handler = new GetChannelPreference(repo, createMockContext());

    const result = await handler.handleAsync({ userId: "no-pref-user" });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toBeNull();
  });

  it("should return cached value on cache hit", async () => {
    const cachedPref = createChannelPreference({ userId: "cached-user", smsEnabled: false });
    const cache = createMockCache();
    (cache.get.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { value: cachedPref } }),
    );

    const repo = createMockChannelPrefRepo();
    const handler = new GetChannelPreference(repo, createMockContext(), cache as any);
    const result = await handler.handleAsync({ userId: "cached-user" });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toEqual(cachedPref);
    // Repo should NOT be called on cache hit
    expect(repo.findByUserId.handleAsync).not.toHaveBeenCalled();
  });

  it("should populate cache on miss", async () => {
    const pref = createChannelPreference({ userId: "cache-miss-user" });
    const cache = createMockCache();
    const repo = createMockChannelPrefRepo();
    (repo.findByUserId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref } }),
    );

    const handler = new GetChannelPreference(repo, createMockContext(), cache as any);
    await handler.handleAsync({ userId: "cache-miss-user" });

    expect(cache.set.handleAsync).toHaveBeenCalledOnce();
    expect(cache.set.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "chan-pref:user:cache-miss-user",
        value: pref,
        expirationMs: 900_000,
      }),
    );
  });

  it("should not populate cache when pref is null", async () => {
    const cache = createMockCache();
    const repo = createMockChannelPrefRepo();

    const handler = new GetChannelPreference(repo, createMockContext(), cache as any);
    await handler.handleAsync({ userId: "no-pref" });

    expect(cache.set.handleAsync).not.toHaveBeenCalled();
  });

  it("should use contact cache key when contactId is provided", async () => {
    const pref = createChannelPreference({ contactId: "contact-99" });
    const cache = createMockCache();
    const repo = createMockChannelPrefRepo();
    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref } }),
    );

    const handler = new GetChannelPreference(repo, createMockContext(), cache as any);
    await handler.handleAsync({ contactId: "contact-99" });

    expect(cache.get.handleAsync).toHaveBeenCalledWith({ key: "chan-pref:contact:contact-99" });
    expect(cache.set.handleAsync).toHaveBeenCalledWith(
      expect.objectContaining({ key: "chan-pref:contact:contact-99" }),
    );
  });
});
