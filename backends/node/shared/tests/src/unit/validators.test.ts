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
    it("should accept standard emails", () => {
      expect(validators.isValidEmail("user@example.com")).toBe(true);
      expect(validators.isValidEmail("a@b.co")).toBe(true);
      expect(validators.isValidEmail("test+tag@domain.org")).toBe(true);
    });

    it("should accept emails with dots in local part", () => {
      expect(validators.isValidEmail("first.last@example.com")).toBe(true);
      expect(validators.isValidEmail("a.b.c.d@example.com")).toBe(true);
    });

    it("should accept emails with subdomains", () => {
      expect(validators.isValidEmail("user@mail.example.com")).toBe(true);
      expect(validators.isValidEmail("user@a.b.c.example.com")).toBe(true);
    });

    it("should accept emails with country-code TLDs", () => {
      expect(validators.isValidEmail("user@example.co.uk")).toBe(true);
      expect(validators.isValidEmail("user@example.com.au")).toBe(true);
      expect(validators.isValidEmail("user@example.co.jp")).toBe(true);
      expect(validators.isValidEmail("user@example.org.br")).toBe(true);
    });

    it("should accept emails with long TLDs", () => {
      expect(validators.isValidEmail("user@example.museum")).toBe(true);
      expect(validators.isValidEmail("user@example.travel")).toBe(true);
      expect(validators.isValidEmail("user@example.photography")).toBe(true);
    });

    it("should accept emails with numbers and hyphens in domain", () => {
      expect(validators.isValidEmail("user@my-domain.com")).toBe(true);
      expect(validators.isValidEmail("user@123.123.123.com")).toBe(true);
      expect(validators.isValidEmail("user@domain123.com")).toBe(true);
    });

    it("should accept emails with special chars in local part", () => {
      expect(validators.isValidEmail("user+tag@example.com")).toBe(true);
      expect(validators.isValidEmail("user_name@example.com")).toBe(true);
      expect(validators.isValidEmail("user-name@example.com")).toBe(true);
      expect(validators.isValidEmail("user123@example.com")).toBe(true);
    });

    it("should reject invalid emails", () => {
      expect(validators.isValidEmail("")).toBe(false);
      expect(validators.isValidEmail("not-an-email")).toBe(false);
      expect(validators.isValidEmail("@domain.com")).toBe(false);
      expect(validators.isValidEmail("user@")).toBe(false);
      expect(validators.isValidEmail("user@ example.com")).toBe(false);
      expect(validators.isValidEmail("user @example.com")).toBe(false);
      expect(validators.isValidEmail("user@domain")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // isValidPhoneE164 (digits only, 7-15 — stored after stripping non-digits)
  // -------------------------------------------------------------------------
  describe("isValidPhoneE164", () => {
    it("should accept US numbers (11 digits)", () => {
      expect(validators.isValidPhoneE164("12125551234")).toBe(true);
      expect(validators.isValidPhoneE164("18005551234")).toBe(true);
    });

    it("should accept UK numbers (12 digits)", () => {
      expect(validators.isValidPhoneE164("442071234567")).toBe(true);
      expect(validators.isValidPhoneE164("447911123456")).toBe(true);
    });

    it("should accept German numbers (10-13 digits)", () => {
      expect(validators.isValidPhoneE164("4930123456")).toBe(true);
      expect(validators.isValidPhoneE164("4915112345678")).toBe(true);
    });

    it("should accept Japanese numbers (11-12 digits)", () => {
      expect(validators.isValidPhoneE164("81312345678")).toBe(true);
      expect(validators.isValidPhoneE164("819012345678")).toBe(true);
    });

    it("should accept Indian numbers (12 digits)", () => {
      expect(validators.isValidPhoneE164("919876543210")).toBe(true);
    });

    it("should accept Australian numbers (11 digits)", () => {
      expect(validators.isValidPhoneE164("61212345678")).toBe(true);
      expect(validators.isValidPhoneE164("61412345678")).toBe(true);
    });

    it("should accept Brazilian numbers (12-13 digits)", () => {
      expect(validators.isValidPhoneE164("551123456789")).toBe(true);
      expect(validators.isValidPhoneE164("5511987654321")).toBe(true);
    });

    it("should accept Chinese numbers (13 digits)", () => {
      expect(validators.isValidPhoneE164("8613812345678")).toBe(true);
    });

    it("should accept boundary lengths (7 and 15 digits)", () => {
      expect(validators.isValidPhoneE164("1234567")).toBe(true);
      expect(validators.isValidPhoneE164("123456789012345")).toBe(true);
    });

    it("should reject numbers that are too short or too long", () => {
      expect(validators.isValidPhoneE164("")).toBe(false);
      expect(validators.isValidPhoneE164("123456")).toBe(false);
      expect(validators.isValidPhoneE164("1234567890123456")).toBe(false);
    });

    it("should reject numbers with non-digit characters (pre-cleaning)", () => {
      expect(validators.isValidPhoneE164("+1234567")).toBe(false);
      expect(validators.isValidPhoneE164("123-456-7890")).toBe(false);
      expect(validators.isValidPhoneE164("(212) 555-1234")).toBe(false);
      expect(validators.isValidPhoneE164("123 456 7890")).toBe(false);
      expect(validators.isValidPhoneE164("abc1234567")).toBe(false);
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
      expect(validators.zodGuid.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(
        true,
      );
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
      expect(schema.safeParse(["550e8400-e29b-41d4-a716-446655440000"]).success).toBe(true);
    });

    it("should reject empty arrays", () => {
      const schema = validators.zodNonEmptyArray(validators.zodGuid);
      expect(schema.safeParse([]).success).toBe(false);
    });
  });
});
