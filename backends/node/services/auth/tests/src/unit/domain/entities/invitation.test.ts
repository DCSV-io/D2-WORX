import { describe, it, expect } from "vitest";
import { createInvitation, AuthValidationError } from "@d2/auth-domain";

describe("Invitation", () => {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const validInput = {
    email: "invite@example.com",
    organizationId: "org-123",
    role: "agent" as const,
    inviterId: "user-456",
    expiresAt: futureDate,
  };

  describe("createInvitation", () => {
    it("should create an invitation with valid input", () => {
      const inv = createInvitation(validInput);
      expect(inv.email).toBe("invite@example.com");
      expect(inv.organizationId).toBe("org-123");
      expect(inv.role).toBe("agent");
      expect(inv.status).toBe("pending");
      expect(inv.inviterId).toBe("user-456");
      expect(inv.expiresAt).toBe(futureDate);
      expect(inv.id).toHaveLength(36);
      expect(inv.createdAt).toBeInstanceOf(Date);
    });

    it("should accept a pre-generated ID", () => {
      const inv = createInvitation({ ...validInput, id: "custom-id" });
      expect(inv.id).toBe("custom-id");
    });

    it("should clean and lowercase the email", () => {
      const inv = createInvitation({ ...validInput, email: "  INVITE@Example.COM  " });
      expect(inv.email).toBe("invite@example.com");
    });

    it("should always start with pending status", () => {
      const inv = createInvitation(validInput);
      expect(inv.status).toBe("pending");
    });

    it("should throw for invalid email", () => {
      expect(() => createInvitation({ ...validInput, email: "not-email" })).toThrow(Error);
    });

    it("should throw AuthValidationError for empty organizationId", () => {
      expect(() => createInvitation({ ...validInput, organizationId: "" })).toThrow(
        AuthValidationError,
      );
    });

    it("should throw AuthValidationError for invalid role", () => {
      expect(() => createInvitation({ ...validInput, role: "invalid" as never })).toThrow(
        AuthValidationError,
      );
    });

    it("should throw AuthValidationError for empty inviterId", () => {
      expect(() => createInvitation({ ...validInput, inviterId: "" })).toThrow(AuthValidationError);
    });

    it("should throw AuthValidationError for past expiresAt", () => {
      const pastDate = new Date(Date.now() - 1000);
      expect(() => createInvitation({ ...validInput, expiresAt: pastDate })).toThrow(
        AuthValidationError,
      );
    });

    it("should throw AuthValidationError for invalid date", () => {
      expect(() => createInvitation({ ...validInput, expiresAt: new Date("invalid") })).toThrow(
        AuthValidationError,
      );
    });

    it.each(["owner", "officer", "agent", "auditor"] as const)(
      "should accept valid role '%s'",
      (role) => {
        const inv = createInvitation({ ...validInput, role });
        expect(inv.role).toBe(role);
      },
    );
  });
});
