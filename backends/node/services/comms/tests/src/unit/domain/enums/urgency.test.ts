import { describe, it, expect } from "vitest";
import { URGENCIES, isValidUrgency } from "@d2/comms-domain";

describe("Urgency", () => {
  it("should have exactly 2 urgency levels", () => {
    expect(URGENCIES).toHaveLength(2);
  });

  it("should contain all expected levels", () => {
    expect(URGENCIES).toContain("normal");
    expect(URGENCIES).toContain("urgent");
  });

  describe("isValidUrgency", () => {
    it.each(["normal", "urgent"])(
      "should return true for valid urgency '%s'",
      (urgency) => {
        expect(isValidUrgency(urgency)).toBe(true);
      },
    );

    it.each(["Normal", "URGENT", "important", "critical", "low", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidUrgency(value)).toBe(false);
      },
    );
  });
});
