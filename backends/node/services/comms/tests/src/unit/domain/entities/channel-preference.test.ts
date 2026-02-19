import { describe, it, expect } from "vitest";
import {
  createChannelPreference,
  updateChannelPreference,
  CommsValidationError,
} from "@d2/comms-domain";

describe("ChannelPreference", () => {
  const validInput = { userId: "user-123" };

  describe("createChannelPreference", () => {
    it("should create preferences with defaults", () => {
      const pref = createChannelPreference(validInput);
      expect(pref.userId).toBe("user-123");
      expect(pref.emailEnabled).toBe(true);
      expect(pref.smsEnabled).toBe(true);
      expect(pref.quietHoursStart).toBeNull();
      expect(pref.quietHoursEnd).toBeNull();
      expect(pref.quietHoursTz).toBeNull();
      expect(pref.id).toHaveLength(36);
    });

    it("should accept contactId as owner", () => {
      const pref = createChannelPreference({ contactId: "contact-1" });
      expect(pref.contactId).toBe("contact-1");
      expect(pref.userId).toBeNull();
    });

    it("should accept custom channel settings", () => {
      const pref = createChannelPreference({
        ...validInput,
        emailEnabled: false,
        smsEnabled: false,
      });
      expect(pref.emailEnabled).toBe(false);
      expect(pref.smsEnabled).toBe(false);
    });

    it("should accept valid quiet hours", () => {
      const pref = createChannelPreference({
        ...validInput,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "America/New_York",
      });
      expect(pref.quietHoursStart).toBe("22:00");
      expect(pref.quietHoursEnd).toBe("07:00");
      expect(pref.quietHoursTz).toBe("America/New_York");
    });

    it("should throw when no owner is provided", () => {
      expect(() => createChannelPreference({})).toThrow(CommsValidationError);
    });

    it("should throw when quiet hours are partially set (start only)", () => {
      expect(() =>
        createChannelPreference({ ...validInput, quietHoursStart: "22:00" }),
      ).toThrow(CommsValidationError);
    });

    it("should throw when quiet hours are partially set (start + end, no tz)", () => {
      expect(() =>
        createChannelPreference({
          ...validInput,
          quietHoursStart: "22:00",
          quietHoursEnd: "07:00",
        }),
      ).toThrow(CommsValidationError);
    });

    it("should throw when quiet hours start is invalid format", () => {
      expect(() =>
        createChannelPreference({
          ...validInput,
          quietHoursStart: "25:00",
          quietHoursEnd: "07:00",
          quietHoursTz: "UTC",
        }),
      ).toThrow(CommsValidationError);
    });

    it("should throw when quiet hours end is invalid format", () => {
      expect(() =>
        createChannelPreference({
          ...validInput,
          quietHoursStart: "22:00",
          quietHoursEnd: "7:00",
          quietHoursTz: "UTC",
        }),
      ).toThrow(CommsValidationError);
    });

    // --- Time format boundary values ---

    it("should accept 00:00 as valid quiet hours time", () => {
      const pref = createChannelPreference({
        ...validInput,
        quietHoursStart: "00:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      expect(pref.quietHoursStart).toBe("00:00");
    });

    it("should accept 23:59 as valid quiet hours time", () => {
      const pref = createChannelPreference({
        ...validInput,
        quietHoursStart: "22:00",
        quietHoursEnd: "23:59",
        quietHoursTz: "UTC",
      });
      expect(pref.quietHoursEnd).toBe("23:59");
    });

    it("should throw for 24:00 (invalid hour)", () => {
      expect(() =>
        createChannelPreference({
          ...validInput,
          quietHoursStart: "24:00",
          quietHoursEnd: "07:00",
          quietHoursTz: "UTC",
        }),
      ).toThrow(CommsValidationError);
    });

    it("should throw for 23:60 (invalid minute)", () => {
      expect(() =>
        createChannelPreference({
          ...validInput,
          quietHoursStart: "22:00",
          quietHoursEnd: "23:60",
          quietHoursTz: "UTC",
        }),
      ).toThrow(CommsValidationError);
    });

    it("should throw for single-digit hour (1:30)", () => {
      expect(() =>
        createChannelPreference({
          ...validInput,
          quietHoursStart: "1:30",
          quietHoursEnd: "07:00",
          quietHoursTz: "UTC",
        }),
      ).toThrow(CommsValidationError);
    });

    it("should accept both userId and contactId simultaneously", () => {
      const pref = createChannelPreference({
        userId: "user-1",
        contactId: "contact-1",
      });
      expect(pref.userId).toBe("user-1");
      expect(pref.contactId).toBe("contact-1");
    });

    it("should accept all quiet hours fields explicitly null", () => {
      const pref = createChannelPreference({
        ...validInput,
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
      });
      expect(pref.quietHoursStart).toBeNull();
      expect(pref.quietHoursEnd).toBeNull();
      expect(pref.quietHoursTz).toBeNull();
    });
  });

  describe("updateChannelPreference", () => {
    const basePref = createChannelPreference(validInput);

    it("should update emailEnabled", () => {
      const updated = updateChannelPreference(basePref, { emailEnabled: false });
      expect(updated.emailEnabled).toBe(false);
      expect(updated.smsEnabled).toBe(true);
    });

    it("should update smsEnabled", () => {
      const updated = updateChannelPreference(basePref, { smsEnabled: false });
      expect(updated.smsEnabled).toBe(false);
    });

    it("should set quiet hours", () => {
      const updated = updateChannelPreference(basePref, {
        quietHoursStart: "23:00",
        quietHoursEnd: "06:00",
        quietHoursTz: "Europe/London",
      });
      expect(updated.quietHoursStart).toBe("23:00");
      expect(updated.quietHoursEnd).toBe("06:00");
      expect(updated.quietHoursTz).toBe("Europe/London");
    });

    it("should clear quiet hours by setting all to null", () => {
      const withQuiet = createChannelPreference({
        ...validInput,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      const cleared = updateChannelPreference(withQuiet, {
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTz: null,
      });
      expect(cleared.quietHoursStart).toBeNull();
      expect(cleared.quietHoursEnd).toBeNull();
      expect(cleared.quietHoursTz).toBeNull();
    });

    it("should update updatedAt", () => {
      const updated = updateChannelPreference(basePref, { emailEnabled: false });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(basePref.updatedAt.getTime());
    });

    it("should throw when quiet hours partially updated", () => {
      expect(() =>
        updateChannelPreference(basePref, { quietHoursStart: "22:00" }),
      ).toThrow(CommsValidationError);
    });

    it("should preserve existing quiet hours when updating only channel flags", () => {
      const withQuiet = createChannelPreference({
        ...validInput,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      const updated = updateChannelPreference(withQuiet, { emailEnabled: false });
      expect(updated.quietHoursStart).toBe("22:00");
      expect(updated.quietHoursEnd).toBe("07:00");
      expect(updated.quietHoursTz).toBe("UTC");
      expect(updated.emailEnabled).toBe(false);
    });

    it("should allow updating only quiet hours start while keeping end and tz", () => {
      const withQuiet = createChannelPreference({
        ...validInput,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        quietHoursTz: "UTC",
      });
      const updated = updateChannelPreference(withQuiet, { quietHoursStart: "23:00" });
      expect(updated.quietHoursStart).toBe("23:00");
      expect(updated.quietHoursEnd).toBe("07:00");
      expect(updated.quietHoursTz).toBe("UTC");
    });

    it("should preserve userId and contactId on update (immutable)", () => {
      const updated = updateChannelPreference(basePref, { emailEnabled: false });
      expect(updated.userId).toBe(basePref.userId);
      expect(updated.id).toBe(basePref.id);
    });
  });
});
