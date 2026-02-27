import { describe, it, expect } from "vitest";
import {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_TRANSITIONS,
  isValidDeliveryStatus,
} from "@d2/comms-domain";

describe("DeliveryStatus", () => {
  it("should have exactly 4 statuses", () => {
    expect(DELIVERY_STATUSES).toHaveLength(4);
  });

  it("should contain all expected statuses", () => {
    expect(DELIVERY_STATUSES).toContain("pending");
    expect(DELIVERY_STATUSES).toContain("sent");
    expect(DELIVERY_STATUSES).toContain("failed");
    expect(DELIVERY_STATUSES).toContain("retried");
  });

  describe("isValidDeliveryStatus", () => {
    it.each(["pending", "sent", "failed", "retried"])(
      "should return true for valid status '%s'",
      (status) => {
        expect(isValidDeliveryStatus(status)).toBe(true);
      },
    );

    it.each(["Pending", "SENT", "delivered", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidDeliveryStatus(value)).toBe(false);
      },
    );
  });

  describe("DELIVERY_STATUS_TRANSITIONS", () => {
    it("should allow pending to transition to sent or failed", () => {
      expect(DELIVERY_STATUS_TRANSITIONS.pending).toContain("sent");
      expect(DELIVERY_STATUS_TRANSITIONS.pending).toContain("failed");
    });

    it("should allow failed to transition to retried", () => {
      expect(DELIVERY_STATUS_TRANSITIONS.failed).toContain("retried");
    });

    it("should have sent as terminal (no transitions)", () => {
      expect(DELIVERY_STATUS_TRANSITIONS.sent).toHaveLength(0);
    });

    it("should have retried as terminal (no transitions)", () => {
      expect(DELIVERY_STATUS_TRANSITIONS.retried).toHaveLength(0);
    });
  });
});
