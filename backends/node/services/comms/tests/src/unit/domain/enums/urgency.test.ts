import { describe, it, expect } from "vitest";
import { URGENCIES, isValidUrgency } from "@d2/comms-domain";

describe("Urgency", () => {
  it("should have exactly 3 urgency levels", () => {
    expect(URGENCIES).toHaveLength(3);
  });

  it("should contain all expected levels", () => {
    expect(URGENCIES).toContain("normal");
    expect(URGENCIES).toContain("important");
    expect(URGENCIES).toContain("urgent");
  });

  describe("isValidUrgency", () => {
    it.each(["normal", "important", "urgent"])(
      "should return true for valid urgency '%s'",
      (urgency) => {
        expect(isValidUrgency(urgency)).toBe(true);
      },
    );

    it.each(["Normal", "URGENT", "critical", "low", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidUrgency(value)).toBe(false);
      },
    );
  });
});
