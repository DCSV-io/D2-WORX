import { describe, it, expect } from "vitest";
import { validators } from "@d2/handler";

describe("validators", () => {
  // -------------------------------------------------------------------------
  // isValidIpAddress
  // -------------------------------------------------------------------------
  describe("isValidIpAddress", () => {
    it("should accept valid IPv4 addresses", () => {
      expect(validators.isValidIpAddress("192.168.1.1")).toBe(true);
      expect(validators.isValidIpAddress("0.0.0.0")).toBe(true);
      expect(validators.isValidIpAddress("255.255.255.255")).toBe(true);
      expect(validators.isValidIpAddress("127.0.0.1")).toBe(true);
    });

    it("should accept valid IPv6 addresses", () => {
      expect(validators.isValidIpAddress("::1")).toBe(true);
      expect(validators.isValidIpAddress("2001:db8::1")).toBe(true);
      expect(validators.isValidIpAddress("fe80::1%eth0")).toBe(true);
      expect(validators.isValidIpAddress("::ffff:192.168.1.1")).toBe(true);
    });

    it("should reject invalid IP addresses", () => {
      expect(validators.isValidIpAddress("")).toBe(false);
      expect(validators.isValidIpAddress("not-an-ip")).toBe(false);
      expect(validators.isValidIpAddress("256.1.1.1")).toBe(false);
      expect(validators.isValidIpAddress("1.2.3")).toBe(false);
      expect(validators.isValidIpAddress("abc")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isValidHashId
  // -------------------------------------------------------------------------
  describe("isValidHashId", () => {
    it("should accept valid 64-char hex strings", () => {
      expect(validators.isValidHashId("a".repeat(64))).toBe(true);
      expect(validators.isValidHashId("ABCDEF0123456789".repeat(4))).toBe(true);
      expect(
        validators.isValidHashId(
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ),
      ).toBe(true);
    });

    it("should reject invalid hash IDs", () => {
      expect(validators.isValidHashId("")).toBe(false);
      expect(validators.isValidHashId("a".repeat(63))).toBe(false);
      expect(validators.isValidHashId("a".repeat(65))).toBe(false);
      expect(validators.isValidHashId("g".repeat(64))).toBe(false); // non-hex
      expect(validators.isValidHashId("xyz")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isValidGuid
  // -------------------------------------------------------------------------
  describe("isValidGuid", () => {
    it("should accept valid UUIDs", () => {
      expect(validators.isValidGuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(validators.isValidGuid("00000000-0000-0000-0000-000000000001")).toBe(true);
    });

    it("should reject invalid UUIDs", () => {
      expect(validators.isValidGuid("")).toBe(false);
      expect(validators.isValidGuid("not-a-guid")).toBe(false);
      expect(validators.isValidGuid("550e8400-e29b-41d4-a716")).toBe(false);
      expect(validators.isValidGuid("550e8400e29b41d4a716446655440000")).toBe(false); // no hyphens
    });
  });

  // -------------------------------------------------------------------------
  // isValidEmail
  // -------------------------------------------------------------------------
  describe("isValidEmail", () => {
    it("should accept valid emails", () => {
      expect(validators.isValidEmail("user@example.com")).toBe(true);
      expect(validators.isValidEmail("a@b.co")).toBe(true);
      expect(validators.isValidEmail("test+tag@domain.org")).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(validators.isValidEmail("")).toBe(false);
      expect(validators.isValidEmail("not-an-email")).toBe(false);
      expect(validators.isValidEmail("@domain.com")).toBe(false);
      expect(validators.isValidEmail("user@")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isValidPhoneE164
  // -------------------------------------------------------------------------
  describe("isValidPhoneE164", () => {
    it("should accept valid phone numbers (7-15 digits)", () => {
      expect(validators.isValidPhoneE164("1234567")).toBe(true); // 7 digits
      expect(validators.isValidPhoneE164("123456789012345")).toBe(true); // 15 digits
      expect(validators.isValidPhoneE164("15551234567")).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      expect(validators.isValidPhoneE164("")).toBe(false);
      expect(validators.isValidPhoneE164("123456")).toBe(false); // too short
      expect(validators.isValidPhoneE164("1234567890123456")).toBe(false); // too long
      expect(validators.isValidPhoneE164("+1234567")).toBe(false); // has +
      expect(validators.isValidPhoneE164("123-456-7890")).toBe(false); // has dashes
    });
  });

  // -------------------------------------------------------------------------
  // Zod schemas
  // -------------------------------------------------------------------------
  describe("zodIpAddress", () => {
    it("should parse valid IP", () => {
      expect(validators.zodIpAddress.safeParse("1.2.3.4").success).toBe(true);
    });

    it("should reject invalid IP", () => {
      expect(validators.zodIpAddress.safeParse("invalid").success).toBe(false);
    });
  });

  describe("zodHashId", () => {
    it("should parse valid hash", () => {
      expect(validators.zodHashId.safeParse("a".repeat(64)).success).toBe(true);
    });

    it("should reject short hash", () => {
      expect(validators.zodHashId.safeParse("a".repeat(63)).success).toBe(false);
    });
  });

  describe("zodGuid", () => {
    it("should parse valid UUID", () => {
      expect(
        validators.zodGuid.safeParse("550e8400-e29b-41d4-a716-446655440000").success,
      ).toBe(true);
    });

    it("should reject invalid UUID", () => {
      expect(validators.zodGuid.safeParse("not-a-guid").success).toBe(false);
    });
  });

  describe("zodNonEmptyString", () => {
    it("should accept non-empty strings within max length", () => {
      expect(validators.zodNonEmptyString(10).safeParse("hello").success).toBe(true);
    });

    it("should reject empty strings", () => {
      expect(validators.zodNonEmptyString(10).safeParse("").success).toBe(false);
    });

    it("should reject strings exceeding max length", () => {
      expect(validators.zodNonEmptyString(3).safeParse("toolong").success).toBe(false);
    });
  });

  describe("zodNonEmptyArray", () => {
    it("should accept non-empty arrays", () => {
      const schema = validators.zodNonEmptyArray(validators.zodGuid);
      expect(
        schema.safeParse(["550e8400-e29b-41d4-a716-446655440000"]).success,
      ).toBe(true);
    });

    it("should reject empty arrays", () => {
      const schema = validators.zodNonEmptyArray(validators.zodGuid);
      expect(schema.safeParse([]).success).toBe(false);
    });
  });
});
