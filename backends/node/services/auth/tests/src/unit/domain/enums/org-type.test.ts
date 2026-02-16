import { describe, it, expect } from "vitest";
import { ORG_TYPES, isValidOrgType } from "@d2/auth-domain";

describe("OrgType", () => {
  it("should have exactly 5 organization types", () => {
    expect(ORG_TYPES).toHaveLength(5);
  });

  it("should contain all expected types", () => {
    expect(ORG_TYPES).toContain("admin");
    expect(ORG_TYPES).toContain("support");
    expect(ORG_TYPES).toContain("customer");
    expect(ORG_TYPES).toContain("third_party");
    expect(ORG_TYPES).toContain("affiliate");
  });

  describe("isValidOrgType", () => {
    it.each(["admin", "support", "customer", "third_party", "affiliate"])(
      "should return true for valid type '%s'",
      (type) => {
        expect(isValidOrgType(type)).toBe(true);
      },
    );

    it.each(["Admin", "SUPPORT", "unknown", "", 42, null, undefined, true])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidOrgType(value)).toBe(false);
      },
    );
  });
});
