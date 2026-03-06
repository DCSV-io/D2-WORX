import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { CheckEmailAvailability, type ICheckEmailAvailabilityHandler } from "@d2/auth-app";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-test",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockRepo(available = true): ICheckEmailAvailabilityHandler {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { available } })),
  };
}

function createMockCache() {
  return {
    get: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: undefined })),
    },
    set: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    },
  };
}

describe("CheckEmailAvailability", () => {
  let repo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    repo = createMockRepo();
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  describe("input validation", () => {
    it("rejects empty email", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext());
      const result = await handler.handleAsync({ email: "" });

      expect(result.success).toBe(false);
      expect(repo.handleAsync).not.toHaveBeenCalled();
    });

    it("rejects email without @ sign", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext());
      const result = await handler.handleAsync({ email: "noatsign" });

      expect(result.success).toBe(false);
      expect(repo.handleAsync).not.toHaveBeenCalled();
    });

    it("rejects email over 254 chars", async () => {
      const longEmail = "a".repeat(246) + "@test.com";
      const handler = new CheckEmailAvailability(repo, createTestContext());
      const result = await handler.handleAsync({ email: longEmail });

      expect(result.success).toBe(false);
      expect(repo.handleAsync).not.toHaveBeenCalled();
    });

    it("accepts valid email format", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext());
      const result = await handler.handleAsync({ email: "test@example.com" });

      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Email normalization
  // -----------------------------------------------------------------------

  describe("email normalization", () => {
    it("lowercases email before calling repo", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext());
      await handler.handleAsync({ email: "TEST@EXAMPLE.COM" });

      expect(repo.handleAsync).toHaveBeenCalledWith({ email: "test@example.com" });
    });

    it("trims whitespace before calling repo", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext());
      await handler.handleAsync({ email: "  user@example.com  " });

      expect(repo.handleAsync).toHaveBeenCalledWith({ email: "user@example.com" });
    });

    it("normalizes both case and whitespace", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext());
      await handler.handleAsync({ email: "  User@EXAMPLE.com  " });

      expect(repo.handleAsync).toHaveBeenCalledWith({ email: "user@example.com" });
    });
  });

  // -----------------------------------------------------------------------
  // Without cache
  // -----------------------------------------------------------------------

  describe("without cache", () => {
    it("returns available=true when repo says available", async () => {
      repo = createMockRepo(true);
      const handler = new CheckEmailAvailability(repo, createTestContext());

      const result = await handler.handleAsync({ email: "new@example.com" });

      expect(result.success).toBe(true);
      expect(result.data?.available).toBe(true);
    });

    it("returns available=false when repo says taken", async () => {
      repo = createMockRepo(false);
      const handler = new CheckEmailAvailability(repo, createTestContext());

      const result = await handler.handleAsync({ email: "taken@example.com" });

      expect(result.success).toBe(true);
      expect(result.data?.available).toBe(false);
    });

    it("bubbles fail when repo fails", async () => {
      repo.handleAsync = vi.fn().mockResolvedValue(
        D2Result.fail({ messages: ["DB error"], statusCode: 500 }),
      );
      const handler = new CheckEmailAvailability(repo, createTestContext());

      const result = await handler.handleAsync({ email: "any@example.com" });

      expect(result.success).toBe(false);
      expect(result.messages).toContain("DB error");
    });

    it("bubbles fail when repo returns undefined data", async () => {
      repo.handleAsync = vi.fn().mockResolvedValue(D2Result.ok({ data: undefined }));
      const handler = new CheckEmailAvailability(repo, createTestContext());

      const result = await handler.handleAsync({ email: "any@example.com" });

      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // With cache
  // -----------------------------------------------------------------------

  describe("with cache", () => {
    let cache: ReturnType<typeof createMockCache>;

    beforeEach(() => {
      cache = createMockCache();
    });

    it("returns cached result on cache hit (repo NOT called)", async () => {
      cache.get.handleAsync = vi
        .fn()
        .mockResolvedValue(D2Result.ok({ data: { value: true } }));
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      const result = await handler.handleAsync({ email: "cached@example.com" });

      expect(result.success).toBe(true);
      expect(result.data?.available).toBe(true);
      expect(repo.handleAsync).not.toHaveBeenCalled();
    });

    it("returns cached false (taken) from cache without calling repo", async () => {
      cache.get.handleAsync = vi
        .fn()
        .mockResolvedValue(D2Result.ok({ data: { value: false } }));
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      const result = await handler.handleAsync({ email: "taken@example.com" });

      expect(result.success).toBe(true);
      expect(result.data?.available).toBe(false);
      expect(repo.handleAsync).not.toHaveBeenCalled();
    });

    it("calls repo on cache miss (undefined data)", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      await handler.handleAsync({ email: "miss@example.com" });

      expect(repo.handleAsync).toHaveBeenCalledOnce();
    });

    it("populates cache with short TTL (30s) for available=true", async () => {
      repo = createMockRepo(true);
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      await handler.handleAsync({ email: "avail@example.com" });

      expect(cache.set.handleAsync).toHaveBeenCalledOnce();
      const setCall = cache.set.handleAsync.mock.calls[0][0];
      expect(setCall.value).toBe(true);
      expect(setCall.expirationMs).toBe(30_000);
    });

    it("populates cache with long TTL (1h) for available=false (taken)", async () => {
      repo = createMockRepo(false);
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      await handler.handleAsync({ email: "taken@example.com" });

      expect(cache.set.handleAsync).toHaveBeenCalledOnce();
      const setCall = cache.set.handleAsync.mock.calls[0][0];
      expect(setCall.value).toBe(false);
      expect(setCall.expirationMs).toBe(3_600_000);
    });

    it("uses normalized email as cache key", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      await handler.handleAsync({ email: "USER@EXAMPLE.COM" });

      const getCall = cache.get.handleAsync.mock.calls[0][0];
      expect(getCall.key).toBe("auth:email-availability:user@example.com");
    });

    it("fails open when cache.get throws (still queries repo)", async () => {
      cache.get.handleAsync = vi.fn().mockRejectedValue(new Error("Cache down"));
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      const result = await handler.handleAsync({ email: "test@example.com" });

      expect(result.success).toBe(true);
      expect(repo.handleAsync).toHaveBeenCalledOnce();
    });

    it("does not fail when cache.set throws (fire-and-forget)", async () => {
      cache.set.handleAsync = vi.fn().mockRejectedValue(new Error("Cache write error"));
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      const result = await handler.handleAsync({ email: "test@example.com" });

      expect(result.success).toBe(true);
      expect(result.data?.available).toBe(true);
    });

    it("does not populate cache when repo fails", async () => {
      repo.handleAsync = vi.fn().mockResolvedValue(
        D2Result.fail({ messages: ["DB error"], statusCode: 500 }),
      );
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      await handler.handleAsync({ email: "err@example.com" });

      expect(cache.set.handleAsync).not.toHaveBeenCalled();
    });

    it("does not populate cache when validation fails", async () => {
      const handler = new CheckEmailAvailability(repo, createTestContext(), cache);

      await handler.handleAsync({ email: "invalid" });

      expect(cache.get.handleAsync).not.toHaveBeenCalled();
      expect(cache.set.handleAsync).not.toHaveBeenCalled();
    });
  });
});
