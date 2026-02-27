import { describe, it, expect, beforeEach, vi } from "vitest";
import { D2Result } from "@d2/result";
import { SetChannelPreference, GetChannelPreference } from "@d2/comms-app";
import type { ChannelPreferenceRepoHandlers } from "@d2/comms-app";
import type { ChannelPreference } from "@d2/comms-domain";
import { createMockContext, createMockChannelPrefRepo } from "../helpers/mock-handlers.js";

const VALID_CONTACT_ID = "019505a0-1234-7abc-8000-000000000001";

function createMockCache() {
  return {
    get: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })) },
    set: { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })) },
  };
}

/** Builds a fake ChannelPreference entity for the "existing pref" path. */
function buildExistingPref(overrides?: Partial<ChannelPreference>): ChannelPreference {
  const now = new Date();
  return {
    id: "pref-existing-id",
    contactId: VALID_CONTACT_ID,
    emailEnabled: true,
    smsEnabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("SetChannelPreference", () => {
  let handler: SetChannelPreference;
  let repo: ReturnType<typeof createMockChannelPrefRepo>;
  let cache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    repo = createMockChannelPrefRepo();
    cache = createMockCache();
    handler = new SetChannelPreference(repo, createMockContext(), cache);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("should reject invalid contactId (not a UUID)", async () => {
    const result = await handler.handleAsync({
      contactId: "not-a-uuid",
      emailEnabled: false,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it("should reject empty contactId", async () => {
    const result = await handler.handleAsync({
      contactId: "",
      emailEnabled: true,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Create path — no existing preference
  // -------------------------------------------------------------------------

  it("should create a new preference when none exists", async () => {
    const result = await handler.handleAsync({
      contactId: VALID_CONTACT_ID,
      emailEnabled: false,
      smsEnabled: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.pref.contactId).toBe(VALID_CONTACT_ID);
    expect(result.data!.pref.emailEnabled).toBe(false);
    expect(result.data!.pref.smsEnabled).toBe(true);

    // Should call repo.create (not repo.update)
    expect(repo.create.handleAsync).toHaveBeenCalledOnce();
    expect(repo.update.handleAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Update path — existing preference merged
  // -------------------------------------------------------------------------

  it("should update an existing preference with merged values", async () => {
    const existing = buildExistingPref({ emailEnabled: true, smsEnabled: true });

    // Simulate repo returning an existing pref
    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref: existing } }),
    );

    const result = await handler.handleAsync({
      contactId: VALID_CONTACT_ID,
      emailEnabled: false,
      // smsEnabled omitted — should keep existing value (true)
    });

    expect(result.success).toBe(true);
    expect(result.data!.pref.emailEnabled).toBe(false);
    expect(result.data!.pref.smsEnabled).toBe(true); // Unchanged

    // Should call repo.update (not repo.create)
    expect(repo.update.handleAsync).toHaveBeenCalledOnce();
    expect(repo.create.handleAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cache eviction + repopulation
  // -------------------------------------------------------------------------

  it("should populate cache after setting preference", async () => {
    await handler.handleAsync({
      contactId: VALID_CONTACT_ID,
      emailEnabled: true,
    });

    expect(cache.set.handleAsync).toHaveBeenCalledOnce();

    const setCall = (cache.set.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(setCall.key).toBe(`comms:channel-pref:${VALID_CONTACT_ID}`);
    expect(setCall.value.contactId).toBe(VALID_CONTACT_ID);
    expect(setCall.expirationMs).toBe(900_000);
  });

  // -------------------------------------------------------------------------
  // Works without cache
  // -------------------------------------------------------------------------

  it("should succeed without cache (cache is optional)", async () => {
    const noCacheHandler = new SetChannelPreference(repo, createMockContext());

    const result = await noCacheHandler.handleAsync({
      contactId: VALID_CONTACT_ID,
      emailEnabled: false,
      smsEnabled: false,
    });

    expect(result.success).toBe(true);
    expect(result.data!.pref.emailEnabled).toBe(false);
    expect(result.data!.pref.smsEnabled).toBe(false);
    // No cache interaction should occur — handler just doesn't call it
    expect(cache.set.handleAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Both fields undefined — defaults applied
  // -------------------------------------------------------------------------

  it("should apply channel defaults when both emailEnabled and smsEnabled are undefined", async () => {
    const result = await handler.handleAsync({
      contactId: VALID_CONTACT_ID,
      // Both omitted — domain createChannelPreference uses CHANNEL_DEFAULTS
    });

    expect(result.success).toBe(true);
    // CHANNEL_DEFAULTS: EMAIL_ENABLED = true, SMS_ENABLED = true
    expect(result.data!.pref.emailEnabled).toBe(true);
    expect(result.data!.pref.smsEnabled).toBe(true);
  });

  it("should apply defaults on update path when both fields undefined (no change)", async () => {
    const existing = buildExistingPref({ emailEnabled: false, smsEnabled: false });

    (repo.findByContactId.handleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      D2Result.ok({ data: { pref: existing } }),
    );

    const result = await handler.handleAsync({
      contactId: VALID_CONTACT_ID,
      // Both omitted — updateChannelPreference keeps existing values
    });

    expect(result.success).toBe(true);
    // Existing values preserved (not overridden by defaults)
    expect(result.data!.pref.emailEnabled).toBe(false);
    expect(result.data!.pref.smsEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-handler cache coherence: SetChannelPreference → GetChannelPreference
// ---------------------------------------------------------------------------

describe("Cross-handler cache coherence: SetChannelPreference → GetChannelPreference", () => {
  const CONTACT_ID = "019505a0-1234-7abc-8000-000000000099";

  it("preference written by SetChannelPreference should be readable by GetChannelPreference via the same cache key", async () => {
    const repo = createMockChannelPrefRepo();

    // Use a real-ish cache that records calls and stores values
    const cacheStore = new Map<string, unknown>();
    const cache = {
      get: {
        handleAsync: vi.fn().mockImplementation(async (input: { key: string }) => {
          const value = cacheStore.get(input.key);
          return D2Result.ok({ data: { value } });
        }),
      },
      set: {
        handleAsync: vi.fn().mockImplementation(async (input: { key: string; value: unknown }) => {
          cacheStore.set(input.key, input.value);
          return D2Result.ok({ data: {} });
        }),
      },
    };

    // Step 1: Set preference via SetChannelPreference
    const setHandler = new SetChannelPreference(repo, createMockContext(), cache);
    const setResult = await setHandler.handleAsync({
      contactId: CONTACT_ID,
      emailEnabled: false,
      smsEnabled: true,
    });
    expect(setResult.success).toBe(true);

    // Verify the cache was populated with the correct key format
    const expectedKey = `comms:channel-pref:${CONTACT_ID}`;
    expect(cacheStore.has(expectedKey)).toBe(true);

    // Step 2: Read preference via GetChannelPreference — should find it in cache
    const getHandler = new GetChannelPreference(repo, createMockContext(), cache);
    const getResult = await getHandler.handleAsync({ contactId: CONTACT_ID });

    expect(getResult.success).toBe(true);
    expect(getResult.data!.pref!.contactId).toBe(CONTACT_ID);
    expect(getResult.data!.pref!.emailEnabled).toBe(false);
    expect(getResult.data!.pref!.smsEnabled).toBe(true);

    // Repo should NOT be called for the GET — cache hit
    expect(repo.findByContactId.handleAsync).toHaveBeenCalledTimes(1); // only from SetChannelPreference
  });

  it("both handlers should use the exact same cache key format comms:channel-pref:{contactId}", async () => {
    const repo = createMockChannelPrefRepo();
    const cache = createMockCache();

    // Set handler writes to cache
    const setHandler = new SetChannelPreference(repo, createMockContext(), cache);
    await setHandler.handleAsync({
      contactId: CONTACT_ID,
      emailEnabled: true,
    });

    const setCacheKey = (cache.set.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0].key;

    // Get handler reads from cache
    const getHandler = new GetChannelPreference(repo, createMockContext(), cache);
    await getHandler.handleAsync({ contactId: CONTACT_ID });

    const getCacheKey = (cache.get.handleAsync as ReturnType<typeof vi.fn>).mock.calls[0][0].key;

    // Both must use identical key format
    expect(setCacheKey).toBe(`comms:channel-pref:${CONTACT_ID}`);
    expect(getCacheKey).toBe(`comms:channel-pref:${CONTACT_ID}`);
    expect(setCacheKey).toBe(getCacheKey);
  });
});
