import { describe, it, expect } from "vitest";
import { ROLES, ROLE_HIERARCHY, isValidRole } from "@d2/auth-domain";
import type { Role } from "@d2/auth-domain";

describe("Role", () => {
  it("should have exactly 4 roles", () => {
    expect(ROLES).toHaveLength(4);
  });

  it("should contain all expected roles", () => {
    expect(ROLES).toContain("owner");
    expect(ROLES).toContain("officer");
    expect(ROLES).toContain("agent");
    expect(ROLES).toContain("auditor");
  });

  describe("isValidRole", () => {
    it.each(["owner", "officer", "agent", "auditor"])(
      "should return true for valid role '%s'",
      (role) => {
        expect(isValidRole(role)).toBe(true);
      },
    );

    it.each(["Owner", "OFFICER", "admin", "member", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidRole(value)).toBe(false);
      },
    );
  });

  describe("ROLE_HIERARCHY", () => {
    it("should have entries for all roles", () => {
      for (const role of ROLES) {
        expect(ROLE_HIERARCHY[role]).toBeDefined();
      }
    });

    it("should rank owner highest", () => {
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.officer);
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.agent);
      expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.auditor);
    });

    it("should rank officer above agent", () => {
      expect(ROLE_HIERARCHY.officer).toBeGreaterThan(ROLE_HIERARCHY.agent);
    });

    it("should rank agent above auditor", () => {
      expect(ROLE_HIERARCHY.agent).toBeGreaterThan(ROLE_HIERARCHY.auditor);
    });

    it("should have strictly ascending hierarchy: auditor < agent < officer < owner", () => {
      const ordered: Role[] = ["auditor", "agent", "officer", "owner"];
      for (let i = 1; i < ordered.length; i++) {
        expect(ROLE_HIERARCHY[ordered[i]!]).toBeGreaterThan(ROLE_HIERARCHY[ordered[i - 1]!]);
      }
    });
  });
});
