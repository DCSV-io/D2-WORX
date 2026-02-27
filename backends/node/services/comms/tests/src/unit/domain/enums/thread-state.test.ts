import { describe, it, expect } from "vitest";
import { THREAD_STATES, THREAD_STATE_TRANSITIONS, isValidThreadState } from "@d2/comms-domain";

describe("ThreadState", () => {
  it("should have exactly 3 states", () => {
    expect(THREAD_STATES).toHaveLength(3);
  });

  it("should contain all expected states", () => {
    expect(THREAD_STATES).toContain("active");
    expect(THREAD_STATES).toContain("archived");
    expect(THREAD_STATES).toContain("closed");
  });

  describe("isValidThreadState", () => {
    it.each(["active", "archived", "closed"])(
      "should return true for valid state '%s'",
      (state) => {
        expect(isValidThreadState(state)).toBe(true);
      },
    );

    it.each(["Active", "CLOSED", "open", "deleted", "", 42, null, undefined])(
      "should return false for invalid value '%s'",
      (value) => {
        expect(isValidThreadState(value)).toBe(false);
      },
    );
  });

  describe("THREAD_STATE_TRANSITIONS", () => {
    it("should allow active to transition to archived or closed", () => {
      expect(THREAD_STATE_TRANSITIONS.active).toContain("archived");
      expect(THREAD_STATE_TRANSITIONS.active).toContain("closed");
    });

    it("should allow archived to transition to active or closed", () => {
      expect(THREAD_STATE_TRANSITIONS.archived).toContain("active");
      expect(THREAD_STATE_TRANSITIONS.archived).toContain("closed");
    });

    it("should have closed as terminal (no transitions)", () => {
      expect(THREAD_STATE_TRANSITIONS.closed).toHaveLength(0);
    });
  });
});
