import { describe, it, expect } from "vitest";
import {
  computeRetryDelay,
  isMaxAttemptsReached,
  computeNextRetryAt,
  RETRY_POLICY,
} from "@d2/comms-domain";

describe("Retry Policy", () => {
  describe("computeRetryDelay", () => {
    it("should return 5s for attempt 1", () => {
      expect(computeRetryDelay(1)).toBe(5_000);
    });

    it("should return 10s for attempt 2", () => {
      expect(computeRetryDelay(2)).toBe(10_000);
    });

    it("should return 30s for attempt 3", () => {
      expect(computeRetryDelay(3)).toBe(30_000);
    });

    it("should return 60s for attempt 4", () => {
      expect(computeRetryDelay(4)).toBe(60_000);
    });

    it("should return 300s for attempt 5", () => {
      expect(computeRetryDelay(5)).toBe(300_000);
    });

    it("should return 300s for attempts beyond array length (overflow)", () => {
      expect(computeRetryDelay(6)).toBe(300_000);
      expect(computeRetryDelay(10)).toBe(300_000);
      expect(computeRetryDelay(100)).toBe(300_000);
    });

    it("should have increasing delays", () => {
      for (let i = 2; i <= 5; i++) {
        expect(computeRetryDelay(i)).toBeGreaterThanOrEqual(computeRetryDelay(i - 1));
      }
    });

    it("should return first delay for attempt 0 (edge case)", () => {
      expect(computeRetryDelay(0)).toBe(5_000);
    });

    it("should return first delay for negative attempt number", () => {
      expect(computeRetryDelay(-1)).toBe(5_000);
      expect(computeRetryDelay(-100)).toBe(5_000);
    });
  });

  describe("isMaxAttemptsReached", () => {
    it("should return false for attempts below max", () => {
      expect(isMaxAttemptsReached(1)).toBe(false);
      expect(isMaxAttemptsReached(5)).toBe(false);
      expect(isMaxAttemptsReached(9)).toBe(false);
    });

    it("should return true at max attempts", () => {
      expect(isMaxAttemptsReached(RETRY_POLICY.MAX_ATTEMPTS)).toBe(true);
    });

    it("should return true beyond max attempts", () => {
      expect(isMaxAttemptsReached(11)).toBe(true);
      expect(isMaxAttemptsReached(100)).toBe(true);
    });
  });

  describe("computeNextRetryAt", () => {
    it("should return now + delay for attempt 1", () => {
      const now = new Date("2026-02-19T12:00:00Z");
      const nextRetry = computeNextRetryAt(1, now);
      expect(nextRetry.getTime()).toBe(now.getTime() + 5_000);
    });

    it("should return now + delay for attempt 3", () => {
      const now = new Date("2026-02-19T12:00:00Z");
      const nextRetry = computeNextRetryAt(3, now);
      expect(nextRetry.getTime()).toBe(now.getTime() + 30_000);
    });

    it("should use current time when now is not provided", () => {
      const before = Date.now();
      const nextRetry = computeNextRetryAt(1);
      const after = Date.now();
      const expectedMin = before + 5_000;
      const expectedMax = after + 5_000;
      expect(nextRetry.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(nextRetry.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });
});
