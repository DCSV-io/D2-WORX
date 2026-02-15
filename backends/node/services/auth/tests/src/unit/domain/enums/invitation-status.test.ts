import { describe, it, expect } from "vitest";
import {
  INVITATION_STATUSES,
  INVITATION_TRANSITIONS,
  isValidInvitationStatus,
} from "@d2/auth-domain";

describe("InvitationStatus", () => {
  it("should have exactly 5 statuses", () => {
    expect(INVITATION_STATUSES).toHaveLength(5);
  });

  it("should contain all expected statuses", () => {
    expect(INVITATION_STATUSES).toContain("pending");
    expect(INVITATION_STATUSES).toContain("accepted");
    expect(INVITATION_STATUSES).toContain("rejected");
    expect(INVITATION_STATUSES).toContain("canceled");
    expect(INVITATION_STATUSES).toContain("expired");
  });

  describe("isValidInvitationStatus", () => {
    it.each(["pending", "accepted", "rejected", "canceled", "expired"])(
      "should return true for valid status '%s'",
      (status) => {
        expect(isValidInvitationStatus(status)).toBe(true);
      },
    );

    it.each(["Pending", "ACCEPTED", "revoked", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidInvitationStatus(value)).toBe(false);
      },
    );
  });

  describe("INVITATION_TRANSITIONS", () => {
    it("should have transition entries for all statuses", () => {
      for (const status of INVITATION_STATUSES) {
        expect(INVITATION_TRANSITIONS[status]).toBeDefined();
      }
    });

    it("should allow pending to transition to accepted, rejected, canceled, or expired", () => {
      expect(INVITATION_TRANSITIONS.pending).toContain("accepted");
      expect(INVITATION_TRANSITIONS.pending).toContain("rejected");
      expect(INVITATION_TRANSITIONS.pending).toContain("canceled");
      expect(INVITATION_TRANSITIONS.pending).toContain("expired");
    });

    it.each(["accepted", "rejected", "canceled", "expired"] as const)(
      "should have no transitions from terminal state '%s'",
      (status) => {
        expect(INVITATION_TRANSITIONS[status]).toHaveLength(0);
      },
    );
  });
});
