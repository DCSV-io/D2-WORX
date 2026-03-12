import { describe, it, expect } from "vitest";
import { RETRY_POLICY } from "@d2/comms-domain";

describe("Comms Constants", () => {
  describe("RETRY_POLICY", () => {
    it("should have 5 delay values", () => {
      expect(RETRY_POLICY.DELAYS_MS).toHaveLength(5);
    });

    it("should have increasing delay values", () => {
      for (let i = 1; i < RETRY_POLICY.DELAYS_MS.length; i++) {
        expect(RETRY_POLICY.DELAYS_MS[i]).toBeGreaterThan(RETRY_POLICY.DELAYS_MS[i - 1]!);
      }
    });

    it("should start at 5s and end at 5min", () => {
      expect(RETRY_POLICY.DELAYS_MS[0]).toBe(5_000);
      expect(RETRY_POLICY.DELAYS_MS[RETRY_POLICY.DELAYS_MS.length - 1]).toBe(300_000);
    });
  });
});
