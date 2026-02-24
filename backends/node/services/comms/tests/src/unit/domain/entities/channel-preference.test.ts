import { describe, it, expect } from "vitest";
import {
  createChannelPreference,
  updateChannelPreference,
  CommsValidationError,
} from "@d2/comms-domain";

describe("ChannelPreference", () => {
  const validInput = { contactId: "contact-123" };

  describe("createChannelPreference", () => {
    it("should create preferences with defaults", () => {
      const pref = createChannelPreference(validInput);
      expect(pref.contactId).toBe("contact-123");
      expect(pref.emailEnabled).toBe(true);
      expect(pref.smsEnabled).toBe(true);
      expect(pref.id).toHaveLength(36);
      expect(pref.createdAt).toBeInstanceOf(Date);
      expect(pref.updatedAt).toBeInstanceOf(Date);
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

    it("should throw when contactId is not provided", () => {
      expect(() => createChannelPreference({ contactId: "" })).toThrow(CommsValidationError);
    });

    it("should generate unique IDs", () => {
      const pref1 = createChannelPreference(validInput);
      const pref2 = createChannelPreference(validInput);
      expect(pref1.id).not.toBe(pref2.id);
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

    it("should update updatedAt", () => {
      const updated = updateChannelPreference(basePref, { emailEnabled: false });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(basePref.updatedAt.getTime());
    });

    it("should preserve contactId on update", () => {
      const updated = updateChannelPreference(basePref, { emailEnabled: false });
      expect(updated.contactId).toBe(basePref.contactId);
      expect(updated.id).toBe(basePref.id);
    });
  });
});
