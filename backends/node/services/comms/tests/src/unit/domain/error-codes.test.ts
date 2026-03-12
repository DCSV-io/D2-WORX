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
});
