import { describe, it, expect, beforeEach, vi } from "vitest";
import { D2Result } from "@d2/result";
import { GetChannelPreference } from "@d2/comms-app";
import type { ChannelPreference } from "@d2/comms-domain";
import { createMockContext, createMockChannelPrefRepo } from "../helpers/mock-handlers.js";

const VALID_CONTACT_ID = "019505a0-1234-7abc-8000-000000000002";

function createMockCache() {
  return {
    get: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })) },
    set: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })) },
  };
}

/** Builds a fake ChannelPreference for test assertions. */
function buildPref(overrides?: Partial<ChannelPreference>): ChannelPreference {
  const now = new Date();
  return {
    id: "pref-id",
    contactId: VALID_CONTACT_ID,
    emailEnabled: true,
    smsEnabled: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("GetChannelPreference", () => {
  let handler: GetChannelPreference;
  let repo: ReturnType<typeof createMockChannelPrefRepo>;
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    repo = createMockChannelPrefRepo();
    cache = createMockCache();
    handler = new GetChannelPreference(repo, createMockContext(), cache);
  });

  // -------------------------------------------------------------------------
  // Cache hit
  // -------------------------------------------------------------------------

  it("should return cached value without calling repo", async () => {
    const cachedPref = buildPref();

    (cache.get.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { value: cachedPref } }),
    );

    const result = await handler.handleAsync({ contactId: VALID_CONTACT_ID });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toBe(cachedPref);

    // Cache hit means repo should NOT be called
    expect(repo.findByContactId.handleAsync).not.toHaveBeenCalled();
    // Cache should NOT be re-populated on hit
    expect(cache.set.handleAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cache miss — falls through to DB, populates cache
  // -------------------------------------------------------------------------

  it("should fall through to repo on cache miss and populate cache", async () => {
    const dbPref = buildPref();

    // Cache returns undefined (miss)
    (cache.get.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { value: undefined } }),
    );

    // Repo returns the pref
    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref: dbPref } }),
    );

    const result = await handler.handleAsync({ contactId: VALID_CONTACT_ID });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toBe(dbPref);

    // Should have called repo
    expect(repo.findByContactId.handleAsync).toHaveBeenCalledWith({
      contactId: VALID_CONTACT_ID,
    });

    // Should populate cache after DB fetch
    expect(cache.set.handleAsync).toHaveBeenCalledOnce();
    const setCall = (cache.set.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(setCall.key).toBe(`chan-pref:contact:${VALID_CONTACT_ID}`);
    expect(setCall.value).toBe(dbPref);
    expect(setCall.expirationMs).toBe(900_000);
  });

  // -------------------------------------------------------------------------
  // Contact with no preference — returns null pref
  // -------------------------------------------------------------------------

  it("should return null pref when contact has no preference in DB", async () => {
    // Cache miss
    (cache.get.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { value: undefined } }),
    );

    // Repo returns null pref (default from mock)
    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref: null } }),
    );

    const result = await handler.handleAsync({ contactId: VALID_CONTACT_ID });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toBeNull();

    // Should NOT populate cache when pref is null
    expect(cache.set.handleAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Works without cache
  // -------------------------------------------------------------------------

  it("should succeed without cache (cache is optional)", async () => {
    const noCacheHandler = new GetChannelPreference(repo, createMockContext());
    const dbPref = buildPref();

    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref: dbPref } }),
    );

    const result = await noCacheHandler.handleAsync({ contactId: VALID_CONTACT_ID });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toBe(dbPref);

    // No cache interactions at all
    expect(cache.get.handleAsync).not.toHaveBeenCalled();
    expect(cache.set.handleAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Empty/falsy contactId — returns null pref (early exit)
  // -------------------------------------------------------------------------

  it("should return null pref for empty string contactId", async () => {
    const result = await handler.handleAsync({ contactId: "" });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toBeNull();

    // Should NOT call cache or repo for empty contactId
    expect(cache.get.handleAsync).not.toHaveBeenCalled();
    expect(repo.findByContactId.handleAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Edge case: cache.get fails — should fall through to DB
  // -------------------------------------------------------------------------

  it("should fall through to repo when cache.get fails", async () => {
    const dbPref = buildPref();

    // Cache fails
    (cache.get.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.fail({ messages: ["Cache unavailable"] }),
    );

    // Repo returns pref
    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref: dbPref } }),
    );

    const result = await handler.handleAsync({ contactId: VALID_CONTACT_ID });

    expect(result.success).toBe(true);
    expect(result.data!.pref).toBe(dbPref);

    // Should still populate cache on miss even after cache.get failure
    expect(cache.set.handleAsync).toHaveBeenCalledOnce();
  });
});
