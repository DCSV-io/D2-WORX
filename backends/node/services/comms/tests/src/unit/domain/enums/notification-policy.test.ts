import { describe, it, expect } from "vitest";
import { NOTIFICATION_POLICIES, isValidNotificationPolicy } from "@d2/comms-domain";

describe("NotificationPolicy", () => {
  it("should have exactly 3 policies", () => {
    expect(NOTIFICATION_POLICIES).toHaveLength(3);
  });

  it("should contain all expected policies", () => {
    expect(NOTIFICATION_POLICIES).toContain("all_messages");
    expect(NOTIFICATION_POLICIES).toContain("mentions_only");
    expect(NOTIFICATION_POLICIES).toContain("none");
  });

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
