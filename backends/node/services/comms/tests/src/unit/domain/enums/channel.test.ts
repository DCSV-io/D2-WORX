import { describe, it, expect } from "vitest";
import { CHANNELS, isValidChannel } from "@d2/comms-domain";

describe("Channel", () => {
  it("should have exactly 2 channels", () => {
    expect(CHANNELS).toHaveLength(2);
  });

  it("should contain email and sms", () => {
    expect(CHANNELS).toContain("email");
    expect(CHANNELS).toContain("sms");
  });

  describe("isValidChannel", () => {
    it.each(["email", "sms"])("should return true for valid channel '%s'", (ch) => {
      expect(isValidChannel(ch)).toBe(true);
    });

    it.each(["push", "in_app", "Email", "SMS", "", 42, null, undefined, true])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidChannel(value)).toBe(false);
      },
    );
  });
});
