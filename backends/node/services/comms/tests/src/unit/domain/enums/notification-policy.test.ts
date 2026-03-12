import { describe, it, expect } from "vitest";
import { isValidNotificationPolicy } from "@d2/comms-domain";

describe("NotificationPolicy", () => {
  describe("isValidNotificationPolicy", () => {
    it.each(["all_messages", "mentions_only", "none"])(
      "should return true for valid policy '%s'",
      (policy) => {
        expect(isValidNotificationPolicy(policy)).toBe(true);
      },
    );

    it.each(["all", "mentions", "All_Messages", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidNotificationPolicy(value)).toBe(false);
      },
    );
  });
});
