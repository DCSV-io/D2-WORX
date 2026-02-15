import { describe, it, expect } from "vitest";
import {
  transitionInvitationStatus,
  isInvitationExpired,
  createInvitation,
  AuthDomainError,
} from "@d2/auth-domain";
import type { Invitation, InvitationStatus } from "@d2/auth-domain";

function makeInvitation(status: InvitationStatus = "pending"): Invitation {
  const inv = createInvitation({
    email: "test@example.com",
    organizationId: "org-1",
    role: "agent",
    inviterId: "user-1",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  // Override status for testing terminal states
  return { ...inv, status };
}

describe("invitation rules", () => {
  describe("transitionInvitationStatus", () => {
    it.each(["accepted", "rejected", "canceled", "expired"] as const)(
      "should allow pending → %s",
      (newStatus) => {
        const inv = makeInvitation("pending");
        const result = transitionInvitationStatus(inv, newStatus);
        expect(result.status).toBe(newStatus);
        expect(result.id).toBe(inv.id);
      },
    );

    it.each(["accepted", "rejected", "canceled", "expired"] as const)(
      "should throw for transition from terminal state '%s'",
      (terminalStatus) => {
        const inv = makeInvitation(terminalStatus);
        expect(() => transitionInvitationStatus(inv, "pending")).toThrow(AuthDomainError);
      },
    );

    it("should throw for invalid transition from pending to pending", () => {
      const inv = makeInvitation("pending");
      expect(() => transitionInvitationStatus(inv, "pending")).toThrow(AuthDomainError);
    });

    it("should include status names in error message", () => {
      const inv = makeInvitation("accepted");
      expect(() => transitionInvitationStatus(inv, "rejected")).toThrow(
        "Invalid invitation status transition from 'accepted' to 'rejected'.",
      );
    });

    it("should preserve all other fields during transition", () => {
      const inv = makeInvitation("pending");
      const result = transitionInvitationStatus(inv, "accepted");
      expect(result.email).toBe(inv.email);
      expect(result.organizationId).toBe(inv.organizationId);
      expect(result.role).toBe(inv.role);
      expect(result.inviterId).toBe(inv.inviterId);
      expect(result.expiresAt).toBe(inv.expiresAt);
      expect(result.createdAt).toBe(inv.createdAt);
    });
  });

  describe("isInvitationExpired", () => {
    it("should return false for non-expired invitation", () => {
      const inv = makeInvitation();
      expect(isInvitationExpired(inv)).toBe(false);
    });

    it("should return true for expired invitation", () => {
      const inv = { ...makeInvitation(), expiresAt: new Date(Date.now() - 1000) };
      expect(isInvitationExpired(inv)).toBe(true);
    });

    it("should return true for invitation expiring right now", () => {
      const inv = { ...makeInvitation(), expiresAt: new Date(Date.now()) };
      expect(isInvitationExpired(inv)).toBe(true);
    });
  });
});
