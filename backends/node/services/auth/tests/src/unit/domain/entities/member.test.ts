import { describe, it, expect } from "vitest";
import { createMember, AuthValidationError } from "@d2/auth-domain";

describe("Member", () => {
  const validInput = {
    userId: "user-123",
    organizationId: "org-456",
    role: "agent" as const,
  };

  describe("createMember", () => {
    it("should create a member with valid input", () => {
      const member = createMember(validInput);
      expect(member.userId).toBe("user-123");
      expect(member.organizationId).toBe("org-456");
      expect(member.role).toBe("agent");
      expect(member.id).toHaveLength(36);
      expect(member.createdAt).toBeInstanceOf(Date);
    });

    it("should accept a pre-generated ID", () => {
      const member = createMember({ ...validInput, id: "custom-id" });
      expect(member.id).toBe("custom-id");
    });

    it.each(["owner", "officer", "agent", "auditor"] as const)(
      "should accept valid role '%s'",
      (role) => {
        const member = createMember({ ...validInput, role });
        expect(member.role).toBe(role);
      },
    );

    it("should throw AuthValidationError for empty userId", () => {
      expect(() => createMember({ ...validInput, userId: "" })).toThrow(AuthValidationError);
    });

    it("should throw AuthValidationError for empty organizationId", () => {
      expect(() => createMember({ ...validInput, organizationId: "" })).toThrow(
        AuthValidationError,
      );
    });

    it("should throw AuthValidationError for invalid role", () => {
      expect(() => createMember({ ...validInput, role: "invalid" as never })).toThrow(
        AuthValidationError,
      );
    });
  });
});
