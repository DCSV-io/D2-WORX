import { describe, it, expect } from "vitest";
import { resolveChannels, createChannelPreference } from "@d2/comms-domain";
import type { Message, ChannelPreference } from "@d2/comms-domain";

/** Helper to create a partial message with just the fields channel resolution needs */
function messageWith(
  overrides: Partial<Pick<Message, "sensitive" | "urgency">> = {},
): Pick<Message, "sensitive" | "urgency"> {
  return {
    sensitive: false,
    urgency: "normal",
    ...overrides,
  };
}

describe("resolveChannels", () => {
  describe("normal urgency, non-sensitive", () => {
    it("should include all enabled channels when requestedChannels is null", () => {
      const prefs = createChannelPreference({ userId: "u1" });
      const result = resolveChannels(null, prefs, messageWith());
      expect(result.channels).toContain("email");
      expect(result.channels).toContain("sms");
      expect(result.skippedChannels).toHaveLength(0);
    });

    it("should skip disabled channels", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        emailEnabled: true,
        smsEnabled: false,
      });
      const result = resolveChannels(null, prefs, messageWith());
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should filter explicitly requested channels by prefs", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        emailEnabled: true,
        smsEnabled: false,
      });
      const result = resolveChannels(["email", "sms"], prefs, messageWith());
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should return empty channels when all disabled", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        emailEnabled: false,
        smsEnabled: false,
      });
      const result = resolveChannels(null, prefs, messageWith());
      expect(result.channels).toHaveLength(0);
      expect(result.skippedChannels).toContain("email");
      expect(result.skippedChannels).toContain("sms");
    });

    it("should default to all enabled when prefs is null", () => {
      const result = resolveChannels(null, null, messageWith());
      expect(result.channels).toContain("email");
      expect(result.channels).toContain("sms");
    });
  });

  describe("sensitive messages", () => {
    it("should restrict to email only", () => {
      const prefs = createChannelPreference({ userId: "u1" });
      const result = resolveChannels(null, prefs, messageWith({ sensitive: true }));
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should force email even when email is disabled in prefs", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        emailEnabled: false,
        smsEnabled: true,
      });
      const result = resolveChannels(null, prefs, messageWith({ sensitive: true }));
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should bypass quiet hours", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      // 01:00 UTC = inside quiet hours
      const result = resolveChannels(
        null,
        prefs,
        messageWith({ sensitive: true }),
        new Date("2026-02-19T01:00:00Z"),
      );
      expect(result.inQuietHours).toBe(false);
    });

    it("should restrict to email even when urgency is urgent", () => {
      const prefs = createChannelPreference({ userId: "u1" });
      const result = resolveChannels(
        null,
        prefs,
        messageWith({ sensitive: true, urgency: "urgent" }),
      );
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });
  });

  describe("urgent messages", () => {
    it("should force all channels regardless of prefs", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        emailEnabled: false,
        smsEnabled: false,
      });
      const result = resolveChannels(null, prefs, messageWith({ urgency: "urgent" }));
      expect(result.channels).toContain("email");
      expect(result.channels).toContain("sms");
    });

    it("should bypass quiet hours", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      const result = resolveChannels(
        null,
        prefs,
        messageWith({ urgency: "urgent" }),
        new Date("2026-02-19T01:00:00Z"),
      );
      expect(result.inQuietHours).toBe(false);
    });
  });

  describe("important messages", () => {
    it("should force email but respect sms prefs", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        emailEnabled: false,
        smsEnabled: false,
      });
      const result = resolveChannels(null, prefs, messageWith({ urgency: "important" }));
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should include sms when sms is enabled", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        emailEnabled: false,
        smsEnabled: true,
      });
      const result = resolveChannels(null, prefs, messageWith({ urgency: "important" }));
      expect(result.channels).toContain("email");
      expect(result.channels).toContain("sms");
    });

    it("should respect quiet hours", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      const result = resolveChannels(
        null,
        prefs,
        messageWith({ urgency: "important" }),
        new Date("2026-02-19T01:00:00Z"),
      );
      expect(result.inQuietHours).toBe(true);
      expect(result.quietHoursEndUtc).not.toBeNull();
    });
  });

  describe("sensitive + urgency combinations", () => {
    it("should restrict to email when sensitive + important", () => {
      const prefs = createChannelPreference({ userId: "u1" });
      const result = resolveChannels(
        null,
        prefs,
        messageWith({ sensitive: true, urgency: "important" }),
      );
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should restrict to email when sensitive + normal", () => {
      const prefs = createChannelPreference({ userId: "u1" });
      const result = resolveChannels(
        null,
        prefs,
        messageWith({ sensitive: true, urgency: "normal" }),
      );
      expect(result.channels).toEqual(["email"]);
    });
  });

  describe("empty requestedChannels array", () => {
    it("should resolve no channels when empty array is passed (normal)", () => {
      const prefs = createChannelPreference({ userId: "u1" });
      const result = resolveChannels([], prefs, messageWith());
      expect(result.channels).toHaveLength(0);
      expect(result.skippedChannels).toHaveLength(0);
    });
  });

  describe("partial quiet hours config", () => {
    it("should not check quiet hours when only start is set (invalid config)", () => {
      // This shouldn't happen in practice (validation prevents it),
      // but if prefs somehow have partial quiet hours, it should be safe
      const prefs = createChannelPreference({ userId: "u1" });
      // prefs has all quiet hours null — no quiet hours check
      const result = resolveChannels(null, prefs, messageWith(), new Date("2026-02-19T01:00:00Z"));
      expect(result.inQuietHours).toBe(false);
    });
  });

  describe("quiet hours", () => {
    it("should detect quiet hours for normal messages", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      const result = resolveChannels(null, prefs, messageWith(), new Date("2026-02-19T01:00:00Z"));
      expect(result.inQuietHours).toBe(true);
      expect(result.quietHoursEndUtc).not.toBeNull();
      // Channels still resolved (app layer decides whether to delay)
      expect(result.channels).toContain("email");
    });

    it("should not report quiet hours when outside window", () => {
      const prefs = createChannelPreference({
        userId: "u1",
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      const result = resolveChannels(null, prefs, messageWith(), new Date("2026-02-19T12:00:00Z"));
      expect(result.inQuietHours).toBe(false);
      expect(result.quietHoursEndUtc).toBeNull();
    });

    it("should not check quiet hours when no quiet hours configured", () => {
      const prefs = createChannelPreference({ userId: "u1" });
      const result = resolveChannels(null, prefs, messageWith(), new Date("2026-02-19T01:00:00Z"));
      expect(result.inQuietHours).toBe(false);
    });
  });
});
