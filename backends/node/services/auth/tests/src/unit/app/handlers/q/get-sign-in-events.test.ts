import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result } from "@d2/result";
import { GetSignInEvents } from "@d2/auth-app";
import type { ISignInEventRepository } from "@d2/auth-app";
import type { SignInEvent } from "@d2/auth-domain";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-test",
    isAuthenticated: true,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createMockRepo(): ISignInEventRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findByUserId: vi.fn().mockResolvedValue([]),
    countByUserId: vi.fn().mockResolvedValue(0),
    getLatestEventDate: vi.fn().mockResolvedValue(null),
  };
}

function createMockCache() {
  return {
    get: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { value: undefined } })),
    },
    set: {
      handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })),
    },
  };
}

function createEvent(id: string, createdAt?: Date): SignInEvent {
  return {
    id,
    userId: "user-123",
    successful: true,
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    whoIsId: null,
    createdAt: createdAt ?? new Date("2026-02-08"),
  };
}

describe("GetSignInEvents", () => {
  let repo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    repo = createMockRepo();
  });

  // -----------------------------------------------------------------------
  // Basic tests (no cache)
  // -----------------------------------------------------------------------

  describe("without cache", () => {
    let handler: GetSignInEvents;

    beforeEach(() => {
      handler = new GetSignInEvents(repo, createTestContext());
    });

    it("should return events and total count", async () => {
      const events = [createEvent("evt-1"), createEvent("evt-2")];
      repo.findByUserId = vi.fn().mockResolvedValue(events);
      repo.countByUserId = vi.fn().mockResolvedValue(5);

      const result = await handler.handleAsync({ userId: "user-123" });

      expect(result.success).toBe(true);
      expect(result.data?.events).toHaveLength(2);
      expect(result.data?.total).toBe(5);
    });

    it("should use default limit of 50 and offset of 0", async () => {
      await handler.handleAsync({ userId: "user-123" });

      expect(repo.findByUserId).toHaveBeenCalledWith("user-123", 50, 0);
      expect(repo.countByUserId).toHaveBeenCalledWith("user-123");
    });

    it("should pass custom limit and offset to repository", async () => {
      await handler.handleAsync({ userId: "user-123", limit: 10, offset: 20 });

      expect(repo.findByUserId).toHaveBeenCalledWith("user-123", 10, 20);
    });

    it("should return empty events when none exist", async () => {
      repo.findByUserId = vi.fn().mockResolvedValue([]);
      repo.countByUserId = vi.fn().mockResolvedValue(0);

      const result = await handler.handleAsync({ userId: "user-no-events" });

      expect(result.success).toBe(true);
      expect(result.data?.events).toHaveLength(0);
      expect(result.data?.total).toBe(0);
    });

    it("should call findByUserId and countByUserId in parallel", async () => {
      repo.findByUserId = vi.fn().mockResolvedValue([]);
      repo.countByUserId = vi.fn().mockResolvedValue(0);

      await handler.handleAsync({ userId: "user-123" });

      expect(repo.findByUserId).toHaveBeenCalledOnce();
      expect(repo.countByUserId).toHaveBeenCalledOnce();
    });

    it("should cap limit at 100", async () => {
      await handler.handleAsync({ userId: "user-123", limit: 200 });

      expect(repo.findByUserId).toHaveBeenCalledWith("user-123", 100, 0);
    });

    it("should clamp negative offset to 0", async () => {
      await handler.handleAsync({ userId: "user-123", offset: -5 });

      expect(repo.findByUserId).toHaveBeenCalledWith("user-123", 50, 0);
    });
  });

  // -----------------------------------------------------------------------
  // Cache tests
  // -----------------------------------------------------------------------

  describe("with cache", () => {
    let handler: GetSignInEvents;
    let cache: ReturnType<typeof createMockCache>;

    beforeEach(() => {
      cache = createMockCache();
      handler = new GetSignInEvents(repo, createTestContext(), cache);
    });

    it("should return cached data when cache is fresh (latestDate matches)", async () => {
      const cachedEvents = [createEvent("evt-cached")];
      const latestDate = new Date("2026-02-08");

      // Cache has data with latestDate
      cache.get.handleAsync = vi.fn().mockResolvedValue(
        D2Result.ok({
          data: {
            value: {
              events: cachedEvents,
              total: 1,
              latestDate: latestDate.toISOString(),
            },
          },
        }),
      );

      // Repo returns same latest date — cache is still fresh
      repo.getLatestEventDate = vi.fn().mockResolvedValue(latestDate);

      const result = await handler.handleAsync({ userId: "user-123" });

      expect(result.success).toBe(true);
      expect(result.data?.events).toHaveLength(1);
      expect(result.data?.total).toBe(1);

      // Should NOT hit the DB for events/count
      expect(repo.findByUserId).not.toHaveBeenCalled();
      expect(repo.countByUserId).not.toHaveBeenCalled();

      // Should check latest date
      expect(repo.getLatestEventDate).toHaveBeenCalledWith("user-123");
    });

    it("should refresh data when cache is stale (latestDate changed)", async () => {
      const cachedDate = new Date("2026-02-07");
      const newDate = new Date("2026-02-08");

      // Cache has stale data
      cache.get.handleAsync = vi.fn().mockResolvedValue(
        D2Result.ok({
          data: {
            value: {
              events: [createEvent("old")],
              total: 1,
              latestDate: cachedDate.toISOString(),
            },
          },
        }),
      );

      // Repo says there's a newer event
      repo.getLatestEventDate = vi.fn().mockResolvedValue(newDate);

      // Fresh data from DB
      const freshEvents = [createEvent("new-1", newDate), createEvent("new-2")];
      repo.findByUserId = vi.fn().mockResolvedValue(freshEvents);
      repo.countByUserId = vi.fn().mockResolvedValue(2);

      const result = await handler.handleAsync({ userId: "user-123" });

      expect(result.success).toBe(true);
      expect(result.data?.events).toHaveLength(2);
      expect(result.data?.total).toBe(2);

      // Should have hit DB since cache was stale
      expect(repo.findByUserId).toHaveBeenCalledOnce();
      expect(repo.countByUserId).toHaveBeenCalledOnce();
    });

    it("should query DB on cache miss and populate cache", async () => {
      // Cache returns no value
      cache.get.handleAsync = vi.fn().mockResolvedValue(
        D2Result.ok({ data: { value: undefined } }),
      );

      const events = [createEvent("evt-1")];
      repo.findByUserId = vi.fn().mockResolvedValue(events);
      repo.countByUserId = vi.fn().mockResolvedValue(1);

      const result = await handler.handleAsync({ userId: "user-123" });

      expect(result.success).toBe(true);
      expect(result.data?.events).toHaveLength(1);

      // Should populate cache
      expect(cache.set.handleAsync).toHaveBeenCalledOnce();
      const setCalls = cache.set.handleAsync.mock.calls[0][0];
      expect(setCalls.key).toContain("sign-in-events:user-123:");
      expect(setCalls.value.total).toBe(1);
    });

    it("should query DB when cache get fails", async () => {
      cache.get.handleAsync = vi.fn().mockResolvedValue(
        D2Result.fail({ messages: ["Cache error"] }),
      );

      const events = [createEvent("evt-1")];
      repo.findByUserId = vi.fn().mockResolvedValue(events);
      repo.countByUserId = vi.fn().mockResolvedValue(1);

      const result = await handler.handleAsync({ userId: "user-123" });

      expect(result.success).toBe(true);
      expect(result.data?.events).toHaveLength(1);
    });

    it("should include correct latestDate in cached value", async () => {
      // Cache miss
      cache.get.handleAsync = vi.fn().mockResolvedValue(
        D2Result.ok({ data: { value: undefined } }),
      );

      const eventDate = new Date("2026-02-10T12:00:00.000Z");
      const events = [createEvent("evt-1", eventDate)];
      repo.findByUserId = vi.fn().mockResolvedValue(events);
      repo.countByUserId = vi.fn().mockResolvedValue(1);

      await handler.handleAsync({ userId: "user-123" });

      const setCalls = cache.set.handleAsync.mock.calls[0][0];
      expect(setCalls.value.latestDate).toBe(eventDate.toISOString());
    });

    it("should set latestDate to null in cache when no events exist", async () => {
      cache.get.handleAsync = vi.fn().mockResolvedValue(
        D2Result.ok({ data: { value: undefined } }),
      );

      repo.findByUserId = vi.fn().mockResolvedValue([]);
      repo.countByUserId = vi.fn().mockResolvedValue(0);

      await handler.handleAsync({ userId: "user-123" });

      const setCalls = cache.set.handleAsync.mock.calls[0][0];
      expect(setCalls.value.latestDate).toBeNull();
    });
  });
});
