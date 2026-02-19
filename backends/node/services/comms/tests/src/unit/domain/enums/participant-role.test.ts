import { describe, it, expect } from "vitest";
import {
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_HIERARCHY,
  isValidParticipantRole,
} from "@d2/comms-domain";

describe("ParticipantRole", () => {
  it("should have exactly 4 roles", () => {
    expect(PARTICIPANT_ROLES).toHaveLength(4);
  });

  it("should contain all expected roles", () => {
    expect(PARTICIPANT_ROLES).toContain("observer");
    expect(PARTICIPANT_ROLES).toContain("participant");
    expect(PARTICIPANT_ROLES).toContain("moderator");
    expect(PARTICIPANT_ROLES).toContain("creator");
  });

  describe("isValidParticipantRole", () => {
    it.each(["observer", "participant", "moderator", "creator"])(
      "should return true for valid role '%s'",
      (role) => {
        expect(isValidParticipantRole(role)).toBe(true);
      },
    );

    it.each(["Observer", "CREATOR", "admin", "owner", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidParticipantRole(value)).toBe(false);
      },
    );
  });

  describe("PARTICIPANT_ROLE_HIERARCHY", () => {
    it("should have observer as lowest (0)", () => {
      expect(PARTICIPANT_ROLE_HIERARCHY.observer).toBe(0);
    });

    it("should have participant at level 1", () => {
      expect(PARTICIPANT_ROLE_HIERARCHY.participant).toBe(1);
    });

    it("should have moderator at level 2", () => {
      expect(PARTICIPANT_ROLE_HIERARCHY.moderator).toBe(2);
    });

    it("should have creator as highest (3)", () => {
      expect(PARTICIPANT_ROLE_HIERARCHY.creator).toBe(3);
    });

    it("should have strictly increasing hierarchy", () => {
      expect(PARTICIPANT_ROLE_HIERARCHY.observer).toBeLessThan(
        PARTICIPANT_ROLE_HIERARCHY.participant,
      );
      expect(PARTICIPANT_ROLE_HIERARCHY.participant).toBeLessThan(
        PARTICIPANT_ROLE_HIERARCHY.moderator,
      );
      expect(PARTICIPANT_ROLE_HIERARCHY.moderator).toBeLessThan(
        PARTICIPANT_ROLE_HIERARCHY.creator,
      );
    });
  });
});
