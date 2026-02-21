import { describe, it, expect } from "vitest";
import { isInQuietHours } from "@d2/comms-domain";

describe("isInQuietHours", () => {
  describe("same-day window (08:00–17:00)", () => {
    it("should return true when inside window", () => {
      // 12:00 UTC, timezone UTC → local 12:00 is inside 08:00–17:00
      const result = isInQuietHours("08:00", "17:00", "UTC", new Date("2026-02-19T12:00:00Z"));
      expect(result.inQuietHours).toBe(true);
      expect(result.quietHoursEndUtc).not.toBeNull();
    });

    it("should return false when outside window (before start)", () => {
      // 06:00 UTC
      const result = isInQuietHours("08:00", "17:00", "UTC", new Date("2026-02-19T06:00:00Z"));
      expect(result.inQuietHours).toBe(false);
      expect(result.quietHoursEndUtc).toBeNull();
    });

    it("should return false when outside window (after end)", () => {
      // 18:00 UTC
      const result = isInQuietHours("08:00", "17:00", "UTC", new Date("2026-02-19T18:00:00Z"));
      expect(result.inQuietHours).toBe(false);
      expect(result.quietHoursEndUtc).toBeNull();
    });

    it("should return false when exactly at end time", () => {
      // 17:00 UTC — end is exclusive
      const result = isInQuietHours("08:00", "17:00", "UTC", new Date("2026-02-19T17:00:00Z"));
      expect(result.inQuietHours).toBe(false);
    });

    it("should return true when exactly at start time", () => {
      // 08:00 UTC — start is inclusive
      const result = isInQuietHours("08:00", "17:00", "UTC", new Date("2026-02-19T08:00:00Z"));
      expect(result.inQuietHours).toBe(true);
    });
  });

  describe("overnight window (22:00–07:00)", () => {
    it("should return true when after start (before midnight)", () => {
      // 23:00 UTC
      const result = isInQuietHours("22:00", "07:00", "UTC", new Date("2026-02-19T23:00:00Z"));
      expect(result.inQuietHours).toBe(true);
    });

    it("should return true when after midnight (before end)", () => {
      // 03:00 UTC
      const result = isInQuietHours("22:00", "07:00", "UTC", new Date("2026-02-19T03:00:00Z"));
      expect(result.inQuietHours).toBe(true);
    });

    it("should return false when outside window (daytime)", () => {
      // 12:00 UTC
      const result = isInQuietHours("22:00", "07:00", "UTC", new Date("2026-02-19T12:00:00Z"));
      expect(result.inQuietHours).toBe(false);
    });

    it("should return false when exactly at end time", () => {
      // 07:00 UTC — end is exclusive
      const result = isInQuietHours("22:00", "07:00", "UTC", new Date("2026-02-19T07:00:00Z"));
      expect(result.inQuietHours).toBe(false);
    });
  });

  describe("quietHoursEndUtc computation", () => {
    it("should compute correct end time for same-day window", () => {
      // 12:00 UTC, window 08:00–17:00 → end at 17:00 UTC (5 hours later)
      const now = new Date("2026-02-19T12:00:00Z");
      const result = isInQuietHours("08:00", "17:00", "UTC", now);
      expect(result.inQuietHours).toBe(true);
      expect(result.quietHoursEndUtc!.getTime()).toBe(new Date("2026-02-19T17:00:00Z").getTime());
    });

    it("should compute correct end time for overnight window (before midnight)", () => {
      // 23:00 UTC, window 22:00–07:00 → end at 07:00 next day (8 hours later)
      const now = new Date("2026-02-19T23:00:00Z");
      const result = isInQuietHours("22:00", "07:00", "UTC", now);
      expect(result.inQuietHours).toBe(true);
      expect(result.quietHoursEndUtc!.getTime()).toBe(new Date("2026-02-20T07:00:00Z").getTime());
    });

    it("should compute correct end time for overnight window (after midnight)", () => {
      // 03:00 UTC, window 22:00–07:00 → end at 07:00 same day (4 hours later)
      const now = new Date("2026-02-19T03:00:00Z");
      const result = isInQuietHours("22:00", "07:00", "UTC", now);
      expect(result.inQuietHours).toBe(true);
      expect(result.quietHoursEndUtc!.getTime()).toBe(new Date("2026-02-19T07:00:00Z").getTime());
    });
  });

  describe("boundary times", () => {
    it("should handle midnight start (00:00–07:00)", () => {
      // 03:00 UTC, inside 00:00–07:00
      const result = isInQuietHours("00:00", "07:00", "UTC", new Date("2026-02-19T03:00:00Z"));
      expect(result.inQuietHours).toBe(true);
    });

    it("should handle midnight end (22:00–00:00)", () => {
      // 23:00 UTC, inside 22:00–00:00 (overnight, but end is midnight)
      const result = isInQuietHours("22:00", "00:00", "UTC", new Date("2026-02-19T23:00:00Z"));
      expect(result.inQuietHours).toBe(true);
    });

    it("should handle very short window (22:00–22:01)", () => {
      // 22:00 UTC → inside 1-minute window
      const result = isInQuietHours("22:00", "22:01", "UTC", new Date("2026-02-19T22:00:00Z"));
      expect(result.inQuietHours).toBe(true);
    });

    it("should return false just outside short window", () => {
      // 22:01 UTC → end is exclusive
      const result = isInQuietHours("22:00", "22:01", "UTC", new Date("2026-02-19T22:01:00Z"));
      expect(result.inQuietHours).toBe(false);
    });

    it("should handle 23:59 end boundary", () => {
      // 23:58 UTC, inside 23:00–23:59
      const result = isInQuietHours("23:00", "23:59", "UTC", new Date("2026-02-19T23:58:00Z"));
      expect(result.inQuietHours).toBe(true);
    });
  });

  describe("timezone handling", () => {
    it("should correctly handle EST timezone", () => {
      // 03:00 UTC = 22:00 EST previous day. Window 22:00–07:00 EST → inside
      const result = isInQuietHours(
        "22:00",
        "07:00",
        "America/New_York",
        new Date("2026-02-19T03:00:00Z"),
      );
      expect(result.inQuietHours).toBe(true);
    });

    it("should correctly handle time outside EST quiet hours", () => {
      // 18:00 UTC = 13:00 EST. Window 22:00–07:00 EST → outside
      const result = isInQuietHours(
        "22:00",
        "07:00",
        "America/New_York",
        new Date("2026-02-19T18:00:00Z"),
      );
      expect(result.inQuietHours).toBe(false);
    });
  });
});
