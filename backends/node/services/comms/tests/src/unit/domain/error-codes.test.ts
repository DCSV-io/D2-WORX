import { describe, it, expect } from "vitest";
import { COMMS_ERROR_CODES } from "@d2/comms-domain";

describe("COMMS_ERROR_CODES", () => {
  it("all values are prefixed with COMMS_", () => {
    for (const [, value] of Object.entries(COMMS_ERROR_CODES)) {
      expect(value).toMatch(/^COMMS_/);
    }
  });

  it("all values are unique", () => {
    const values = Object.values(COMMS_ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  it("contains expected error codes", () => {
    expect(COMMS_ERROR_CODES.DELIVERY_FAILED).toBe("COMMS_DELIVERY_FAILED");
    expect(COMMS_ERROR_CODES.RECIPIENT_NOT_FOUND).toBe("COMMS_RECIPIENT_NOT_FOUND");
    expect(COMMS_ERROR_CODES.CHANNEL_UNAVAILABLE).toBe("COMMS_CHANNEL_UNAVAILABLE");
    expect(COMMS_ERROR_CODES.MAX_RETRIES_EXCEEDED).toBe("COMMS_MAX_RETRIES_EXCEEDED");
  });

  it("has exactly 4 error codes", () => {
    expect(Object.keys(COMMS_ERROR_CODES)).toHaveLength(4);
  });

  it("is a const object (readonly at compile time)", () => {
    expect(typeof COMMS_ERROR_CODES).toBe("object");
    expect(COMMS_ERROR_CODES).not.toBeNull();
  });
});
