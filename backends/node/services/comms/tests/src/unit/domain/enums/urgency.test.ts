import { describe, it, expect } from "vitest";
import { isValidUrgency } from "@d2/comms-domain";

describe("Urgency", () => {
  describe("isValidUrgency", () => {
    it.each(["normal", "urgent"])("should return true for valid urgency '%s'", (urgency) => {
      expect(isValidUrgency(urgency)).toBe(true);
    });

    it.each(["Normal", "URGENT", "important", "critical", "low", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidUrgency(value)).toBe(false);
      },
    );
  });
});
