import { describe, it, expect } from "vitest";
import { isValidThreadType } from "@d2/comms-domain";

describe("ThreadType", () => {
  describe("isValidThreadType", () => {
    it.each(["chat", "support", "forum", "system"])(
      "should return true for valid type '%s'",
      (type) => {
        expect(isValidThreadType(type)).toBe(true);
      },
    );

    it.each(["Chat", "FORUM", "dm", "group", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidThreadType(value)).toBe(false);
      },
    );
  });
});
