import { describe, it, expect } from "vitest";
import { isLastOwner, isMemberOfOrg, createMember } from "@d2/auth-domain";
import type { Member } from "@d2/auth-domain";

function makeMember(
  overrides: Partial<Member> & { userId: string; organizationId: string },
): Member {
  return createMember({
    role: "agent",
    ...overrides,
  });
}

describe("membership rules", () => {
  describe("isLastOwner", () => {
    it("should return true when user is the only owner", () => {
      const members = [
        makeMember({ userId: "u1", organizationId: "o1", role: "owner" }),
        makeMember({ userId: "u2", organizationId: "o1", role: "officer" }),
        makeMember({ userId: "u3", organizationId: "o1", role: "agent" }),
      ];
      expect(isLastOwner(members, "u1")).toBe(true);
    });

    it("should return false when there are multiple owners", () => {
      const members = [
        makeMember({ userId: "u1", organizationId: "o1", role: "owner" }),
        makeMember({ userId: "u2", organizationId: "o1", role: "owner" }),
      ];
      expect(isLastOwner(members, "u1")).toBe(false);
    });

    it("should return false when user is not an owner", () => {
      const members = [
        makeMember({ userId: "u1", organizationId: "o1", role: "owner" }),
        makeMember({ userId: "u2", organizationId: "o1", role: "officer" }),
      ];
      expect(isLastOwner(members, "u2")).toBe(false);
    });

    it("should return false for empty members list", () => {
      expect(isLastOwner([], "u1")).toBe(false);
    });

    it("should return false when the only owner is a different user", () => {
      const members = [makeMember({ userId: "u1", organizationId: "o1", role: "owner" })];
      expect(isLastOwner(members, "u2")).toBe(false);
    });
  });

  describe("isMemberOfOrg", () => {
    const members = [
      makeMember({ userId: "u1", organizationId: "o1" }),
      makeMember({ userId: "u1", organizationId: "o2" }),
      makeMember({ userId: "u2", organizationId: "o1" }),
    ];

    it("should return true when user is a member of the org", () => {
      expect(isMemberOfOrg(members, "u1", "o1")).toBe(true);
    });

    it("should return true for user in a different org", () => {
      expect(isMemberOfOrg(members, "u1", "o2")).toBe(true);
    });

    it("should return false when user is not in the org", () => {
      expect(isMemberOfOrg(members, "u2", "o2")).toBe(false);
    });

    it("should return false for unknown user", () => {
      expect(isMemberOfOrg(members, "u99", "o1")).toBe(false);
    });

    it("should return false for empty members list", () => {
      expect(isMemberOfOrg([], "u1", "o1")).toBe(false);
    });
  });
});
