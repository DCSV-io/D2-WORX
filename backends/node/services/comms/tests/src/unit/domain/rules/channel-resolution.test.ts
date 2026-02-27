import { describe, it, expect } from "vitest";
import { resolveChannels, createChannelPreference } from "@d2/comms-domain";
import type { Message } from "@d2/comms-domain";

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
    it("should include all enabled channels", () => {
      const prefs = createChannelPreference({ contactId: "c1" });
      const result = resolveChannels(prefs, messageWith());
      expect(result.channels).toContain("email");
      expect(result.channels).toContain("sms");
      expect(result.skippedChannels).toHaveLength(0);
    });

    it("should skip disabled channels", () => {
      const prefs = createChannelPreference({
        contactId: "c1",
        emailEnabled: true,
        smsEnabled: false,
      });
      const result = resolveChannels(prefs, messageWith());
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should return empty channels when all disabled", () => {
      const prefs = createChannelPreference({
        contactId: "c1",
        emailEnabled: false,
        smsEnabled: false,
      });
      const result = resolveChannels(prefs, messageWith());
      expect(result.channels).toHaveLength(0);
      expect(result.skippedChannels).toContain("email");
      expect(result.skippedChannels).toContain("sms");
    });

    it("should default to all enabled when prefs is null", () => {
      const result = resolveChannels(null, messageWith());
      expect(result.channels).toContain("email");
      expect(result.channels).toContain("sms");
    });
  });

  describe("sensitive messages", () => {
    it("should restrict to email only", () => {
      const prefs = createChannelPreference({ contactId: "c1" });
      const result = resolveChannels(prefs, messageWith({ sensitive: true }));
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should force email even when email is disabled in prefs", () => {
      const prefs = createChannelPreference({
        contactId: "c1",
        emailEnabled: false,
        smsEnabled: true,
      });
      const result = resolveChannels(prefs, messageWith({ sensitive: true }));
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });

    it("should restrict to email even when urgency is urgent", () => {
      const prefs = createChannelPreference({ contactId: "c1" });
      const result = resolveChannels(prefs, messageWith({ sensitive: true, urgency: "urgent" }));
      expect(result.channels).toEqual(["email"]);
      expect(result.skippedChannels).toEqual(["sms"]);
    });
  });

  describe("urgent messages", () => {
    it("should force all channels regardless of prefs", () => {
      const prefs = createChannelPreference({
        contactId: "c1",
        emailEnabled: false,
        smsEnabled: false,
      });
      const result = resolveChannels(prefs, messageWith({ urgency: "urgent" }));
      expect(result.channels).toContain("email");
      expect(result.channels).toContain("sms");
    });
  });
});
