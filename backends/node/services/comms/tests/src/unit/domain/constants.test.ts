import { describe, it, expect } from "vitest";
import {
  RETRY_POLICY,
  DELIVERY_DEFAULTS,
  CHANNEL_DEFAULTS,
  THREAD_CONSTRAINTS,
} from "@d2/comms-domain";

describe("Comms Constants", () => {
  describe("RETRY_POLICY", () => {
    it("should have MAX_ATTEMPTS of 10", () => {
      expect(RETRY_POLICY.MAX_ATTEMPTS).toBe(10);
    });

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

  describe("DELIVERY_DEFAULTS", () => {
    it("should default content format to markdown", () => {
      expect(DELIVERY_DEFAULTS.DEFAULT_CONTENT_FORMAT).toBe("markdown");
    });
  });

  describe("CHANNEL_DEFAULTS", () => {
    it("should have email enabled by default", () => {
      expect(CHANNEL_DEFAULTS.EMAIL_ENABLED).toBe(true);
    });

    it("should have sms enabled by default", () => {
      expect(CHANNEL_DEFAULTS.SMS_ENABLED).toBe(true);
    });
  });

  describe("THREAD_CONSTRAINTS", () => {
    it("should have MAX_TITLE_LENGTH of 255", () => {
      expect(THREAD_CONSTRAINTS.MAX_TITLE_LENGTH).toBe(255);
    });

    it("should have MAX_MESSAGE_LENGTH of 50000", () => {
      expect(THREAD_CONSTRAINTS.MAX_MESSAGE_LENGTH).toBe(50_000);
    });

    it("should have MAX_ATTACHMENTS_PER_MESSAGE of 20", () => {
      expect(THREAD_CONSTRAINTS.MAX_ATTACHMENTS_PER_MESSAGE).toBe(20);
    });

    it("should have MAX_FILE_SIZE_BYTES of 50MB", () => {
      expect(THREAD_CONSTRAINTS.MAX_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
    });

    it("should have MAX_REACTION_LENGTH of 64", () => {
      expect(THREAD_CONSTRAINTS.MAX_REACTION_LENGTH).toBe(64);
    });
  });
});
