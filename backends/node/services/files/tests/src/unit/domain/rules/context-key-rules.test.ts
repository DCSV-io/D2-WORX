import { describe, it, expect } from "vitest";
import {
  isValidContextKeyFormat,
  resolveContextKeyPrefix,
  requiresExternalAccessCheck,
  FILES_FIELD_LIMITS,
} from "@d2/files-domain";

describe("Context Key Rules", () => {
  describe("isValidContextKeyFormat", () => {
    it.each(["user_avatar", "org_logo", "thread_attachment", "simple", "a1_b2_c3"])(
      "should return true for valid format '%s'",
      (key) => {
        expect(isValidContextKeyFormat(key)).toBe(true);
      },
    );

    it.each([
      "User_Avatar", // uppercase
      "user-avatar", // hyphen
      "1user_avatar", // starts with digit
      "_user_avatar", // starts with underscore
      "user__avatar", // double underscore
      "user_", // trailing underscore
      "", // empty
    ])("should return false for invalid format '%s'", (key) => {
      expect(isValidContextKeyFormat(key)).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isValidContextKeyFormat(null)).toBe(false);
      expect(isValidContextKeyFormat(undefined)).toBe(false);
      expect(isValidContextKeyFormat(42)).toBe(false);
      expect(isValidContextKeyFormat(true)).toBe(false);
    });

    it("should return false for key exceeding max length", () => {
      const longKey = "a".repeat(FILES_FIELD_LIMITS.MAX_CONTEXT_KEY_LENGTH + 1);
      expect(isValidContextKeyFormat(longKey)).toBe(false);
    });

    it("should return true for key at exact max length", () => {
      const exactKey = "a".repeat(FILES_FIELD_LIMITS.MAX_CONTEXT_KEY_LENGTH);
      expect(isValidContextKeyFormat(exactKey)).toBe(true);
    });
  });

  describe("resolveContextKeyPrefix", () => {
    it("should resolve user_ prefix", () => {
      const result = resolveContextKeyPrefix("user_avatar");
      expect(result).toEqual({ prefix: "user_", resolution: "jwt" });
    });

    it("should resolve org_ prefix", () => {
      const result = resolveContextKeyPrefix("org_logo");
      expect(result).toEqual({ prefix: "org_", resolution: "jwt" });
    });

    it("should resolve thread_ prefix", () => {
      const result = resolveContextKeyPrefix("thread_attachment");
      expect(result).toEqual({ prefix: "thread_", resolution: "callback" });
    });

    it("should return null for unknown prefix", () => {
      expect(resolveContextKeyPrefix("custom_key")).toBeNull();
      expect(resolveContextKeyPrefix("system_config")).toBeNull();
    });
  });

  describe("requiresExternalAccessCheck", () => {
    it("should return true for thread_ prefixed keys", () => {
      expect(requiresExternalAccessCheck("thread_attachment")).toBe(true);
    });

    it("should return false for user_ prefixed keys", () => {
      expect(requiresExternalAccessCheck("user_avatar")).toBe(false);
    });

    it("should return false for org_ prefixed keys", () => {
      expect(requiresExternalAccessCheck("org_logo")).toBe(false);
    });

    it("should return false for unknown prefix keys", () => {
      expect(requiresExternalAccessCheck("unknown_key")).toBe(false);
    });
  });
});
