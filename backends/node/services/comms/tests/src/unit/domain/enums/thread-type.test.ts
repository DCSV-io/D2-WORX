import { describe, it, expect } from "vitest";
import { THREAD_TYPES, isValidThreadType } from "@d2/comms-domain";

describe("ThreadType", () => {
  it("should have exactly 4 thread types", () => {
    expect(THREAD_TYPES).toHaveLength(4);
  });

  it("should contain all expected types", () => {
    expect(THREAD_TYPES).toContain("chat");
    expect(THREAD_TYPES).toContain("support");
    expect(THREAD_TYPES).toContain("forum");
    expect(THREAD_TYPES).toContain("system");
  });

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
