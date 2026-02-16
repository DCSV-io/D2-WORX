import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSecondaryStorage } from "@d2/auth-infra";
import { D2Result } from "@d2/result";

describe("SecondaryStorage", () => {
  const mockGet = { handleAsync: vi.fn() };
  const mockSet = { handleAsync: vi.fn() };
  const mockRemove = { handleAsync: vi.fn() };

  beforeEach(() => {
    mockGet.handleAsync.mockReset();
    mockSet.handleAsync.mockReset();
    mockRemove.handleAsync.mockReset();
  });

  function createStorage() {
    return createSecondaryStorage({
      get: mockGet as never,
      set: mockSet as never,
      remove: mockRemove as never,
    });
  }

  describe("get", () => {
    it("should return value when cache hit", async () => {
      mockGet.handleAsync.mockResolvedValue(D2Result.ok({ data: { value: '{"session":"data"}' } }));

      const storage = createStorage();
      const result = await storage.get("session-token-123");

      expect(result).toBe('{"session":"data"}');
      expect(mockGet.handleAsync).toHaveBeenCalledWith({
        key: "session-token-123",
      });
    });

    it("should return null when cache miss", async () => {
      mockGet.handleAsync.mockResolvedValue(D2Result.notFound());

      const storage = createStorage();
      const result = await storage.get("missing-key");

      expect(result).toBeNull();
    });

    it("should return null when get fails", async () => {
      mockGet.handleAsync.mockResolvedValue(D2Result.fail({ messages: ["Redis down"] }));

      const storage = createStorage();
      const result = await storage.get("some-key");

      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("should call set handler without TTL when not provided", async () => {
      mockSet.handleAsync.mockResolvedValue(D2Result.ok({ data: {} }));

      const storage = createStorage();
      await storage.set("key", "value");

      expect(mockSet.handleAsync).toHaveBeenCalledWith({
        key: "key",
        value: "value",
        expirationMs: undefined,
      });
    });

    it("should convert TTL from seconds to milliseconds", async () => {
      mockSet.handleAsync.mockResolvedValue(D2Result.ok({ data: {} }));

      const storage = createStorage();
      await storage.set("key", "value", 300);

      expect(mockSet.handleAsync).toHaveBeenCalledWith({
        key: "key",
        value: "value",
        expirationMs: 300_000,
      });
    });
  });

  describe("delete", () => {
    it("should call remove handler", async () => {
      mockRemove.handleAsync.mockResolvedValue(D2Result.ok({ data: {} }));

      const storage = createStorage();
      await storage.delete("session-token-123");

      expect(mockRemove.handleAsync).toHaveBeenCalledWith({
        key: "session-token-123",
      });
    });
  });
});
