import { describe, it, expect } from "vitest";
import { resolveIp, isLocalhost } from "@d2/request-enrichment";
import type { TrustedProxyHeader } from "@d2/request-enrichment";

const ALL_HEADERS: readonly TrustedProxyHeader[] = [
  "cf-connecting-ip",
  "x-real-ip",
  "x-forwarded-for",
];

describe("resolveIp", () => {
  it("should return cf-connecting-ip when present (default trusts CF)", () => {
    const ip = resolveIp({
      "cf-connecting-ip": "1.2.3.4",
      "x-real-ip": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12",
    });
    expect(ip).toBe("1.2.3.4");
  });

  it("should return x-real-ip when cf-connecting-ip is absent and all headers trusted", () => {
    const ip = resolveIp(
      {
        "x-real-ip": "5.6.7.8",
        "x-forwarded-for": "9.10.11.12",
      },
      ALL_HEADERS,
    );
    expect(ip).toBe("5.6.7.8");
  });

  it("should return first entry from x-forwarded-for when all trusted and higher-priority absent", () => {
    const ip = resolveIp(
      {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
      },
      ALL_HEADERS,
    );
    expect(ip).toBe("1.1.1.1");
  });

  it("should trim whitespace from x-forwarded-for entries", () => {
    const ip = resolveIp({ "x-forwarded-for": "  4.4.4.4  , 5.5.5.5" }, ALL_HEADERS);
    expect(ip).toBe("4.4.4.4");
  });

  it("should skip empty entries in x-forwarded-for", () => {
    const ip = resolveIp({ "x-forwarded-for": " , , 6.6.6.6" }, ALL_HEADERS);
    expect(ip).toBe("6.6.6.6");
  });

  it("should return 'unknown' when no headers are present", () => {
    const ip = resolveIp({});
    expect(ip).toBe("unknown");
  });

  it("should handle array-valued headers (first element)", () => {
    const ip = resolveIp({
      "cf-connecting-ip": ["10.0.0.1", "10.0.0.2"],
    });
    expect(ip).toBe("10.0.0.1");
  });

  it("should skip empty cf-connecting-ip and fall through", () => {
    const ip = resolveIp({ "cf-connecting-ip": "", "x-real-ip": "7.7.7.7" }, ALL_HEADERS);
    expect(ip).toBe("7.7.7.7");
  });

  it("should skip whitespace-only cf-connecting-ip and fall through", () => {
    const ip = resolveIp({ "cf-connecting-ip": "   ", "x-real-ip": "8.8.8.8" }, ALL_HEADERS);
    expect(ip).toBe("8.8.8.8");
  });

  it("should preserve IPv4-mapped IPv6 addresses as-is", () => {
    const ip = resolveIp({ "x-real-ip": "::ffff:192.168.1.1" }, ALL_HEADERS);
    expect(ip).toBe("::ffff:192.168.1.1");
  });

  it("should trim x-real-ip", () => {
    const ip = resolveIp({ "x-real-ip": "  9.9.9.9  " }, ALL_HEADERS);
    expect(ip).toBe("9.9.9.9");
  });

  it("should return 'unknown' when all headers are empty strings", () => {
    const ip = resolveIp({
      "cf-connecting-ip": "",
      "x-real-ip": "",
      "x-forwarded-for": "",
    });
    expect(ip).toBe("unknown");
  });

  it("should return 'unknown' when all headers are undefined", () => {
    const ip = resolveIp({
      "cf-connecting-ip": undefined,
      "x-real-ip": undefined,
      "x-forwarded-for": undefined,
    });
    expect(ip).toBe("unknown");
  });

  it("should handle empty array for cf-connecting-ip and fall through", () => {
    const ip = resolveIp({ "cf-connecting-ip": [], "x-real-ip": "11.11.11.11" }, ALL_HEADERS);
    expect(ip).toBe("11.11.11.11");
  });

  it("should handle x-forwarded-for as array (uses first element)", () => {
    const ip = resolveIp(
      { "x-forwarded-for": ["12.12.12.12, 13.13.13.13", "14.14.14.14"] },
      ALL_HEADERS,
    );
    expect(ip).toBe("12.12.12.12");
  });

  it("should return 'unknown' when x-forwarded-for has only commas", () => {
    const ip = resolveIp({ "x-forwarded-for": "," }, ALL_HEADERS);
    expect(ip).toBe("unknown");
  });

  // --- trustedProxyHeaders behavior ---

  it("should ignore x-real-ip when only cf-connecting-ip is trusted (default)", () => {
    const ip = resolveIp({
      "x-real-ip": "10.0.0.1",
      "x-forwarded-for": "10.0.0.2",
    });
    // Default trusts only CF — neither x-real-ip nor x-forwarded-for checked
    expect(ip).toBe("unknown");
  });

  it("should ignore x-forwarded-for when only cf-connecting-ip is trusted", () => {
    const ip = resolveIp({ "x-forwarded-for": "1.2.3.4" }, ["cf-connecting-ip"]);
    expect(ip).toBe("unknown");
  });

  it("should respect x-real-ip when explicitly trusted", () => {
    const ip = resolveIp({ "x-real-ip": "10.0.0.1", "x-forwarded-for": "10.0.0.2" }, ["x-real-ip"]);
    expect(ip).toBe("10.0.0.1");
  });

  it("should respect x-forwarded-for when explicitly trusted but ignore x-real-ip", () => {
    const ip = resolveIp({ "x-real-ip": "10.0.0.1", "x-forwarded-for": "10.0.0.2" }, [
      "x-forwarded-for",
    ]);
    expect(ip).toBe("10.0.0.2");
  });

  it("should return 'unknown' when no headers are trusted", () => {
    const ip = resolveIp(
      { "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" },
      [],
    );
    expect(ip).toBe("unknown");
  });

  it("should not allow spoofing via untrusted headers", () => {
    // Attacker sets CF-Connecting-IP but we only trust x-forwarded-for (Nginx)
    const ip = resolveIp({ "cf-connecting-ip": "127.0.0.1", "x-forwarded-for": "203.0.113.50" }, [
      "x-forwarded-for",
    ]);
    expect(ip).toBe("203.0.113.50");
  });
});

describe("isLocalhost", () => {
  it("should return true for '127.0.0.1'", () => {
    expect(isLocalhost("127.0.0.1")).toBe(true);
  });

  it("should return true for '::1'", () => {
    expect(isLocalhost("::1")).toBe(true);
  });

  it("should return true for 'localhost'", () => {
    expect(isLocalhost("localhost")).toBe(true);
  });

  it("should return true for 'unknown'", () => {
    expect(isLocalhost("unknown")).toBe(true);
  });

  it("should return false for a normal IPv4 address", () => {
    expect(isLocalhost("192.168.1.1")).toBe(false);
  });

  it("should return false for a normal IPv6 address", () => {
    expect(isLocalhost("2001:db8::1")).toBe(false);
  });
});

describe("adversarial inputs", () => {
  // --- resolveIp edge cases ---

  it("should return malformed IPv4 as-is (resolver does not validate)", () => {
    const ip = resolveIp({ "cf-connecting-ip": "999.999.999.999" });
    expect(ip).toBe("999.999.999.999");
  });

  it("should return non-IP garbage string as-is", () => {
    const ip = resolveIp({ "cf-connecting-ip": "not-an-ip-at-all" });
    expect(ip).toBe("not-an-ip-at-all");
  });

  it("should return SQL injection string as-is (no injection vector, just extraction)", () => {
    const ip = resolveIp({ "cf-connecting-ip": "'; DROP TABLE users;--" });
    expect(ip).toBe("'; DROP TABLE users;--");
  });

  it("should truncate extremely long header values to maxForwardedForLength", () => {
    const longValue = "A".repeat(10_000);
    const ip = resolveIp({ "cf-connecting-ip": longValue });
    // Default maxForwardedForLength is 2048
    expect(ip).toHaveLength(2048);
    expect(ip).toBe("A".repeat(2048));
  });

  it("should truncate long header values to custom maxLength when provided", () => {
    const longValue = "B".repeat(500);
    const ip = resolveIp({ "cf-connecting-ip": longValue }, ["cf-connecting-ip"], 100);
    expect(ip).toHaveLength(100);
    expect(ip).toBe("B".repeat(100));
  });

  it("should recognize IPv6 loopback '::1' as localhost", () => {
    expect(isLocalhost("::1")).toBe(true);
  });

  it("should NOT recognize IPv6-mapped IPv4 '::ffff:127.0.0.1' as localhost (exact match only)", () => {
    // isLocalhost uses exact string comparison — mapped format is not matched
    expect(isLocalhost("::ffff:127.0.0.1")).toBe(false);
  });

  it("should NOT recognize '0.0.0.0' as localhost", () => {
    expect(isLocalhost("0.0.0.0")).toBe(false);
  });

  it("should NOT recognize '0:0:0:0:0:0:0:1' (expanded ::1) as localhost", () => {
    expect(isLocalhost("0:0:0:0:0:0:0:1")).toBe(false);
  });

  it("should use CF-Connecting-IP when X-Forwarded-For is empty string", () => {
    const ip = resolveIp(
      { "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "" },
      ALL_HEADERS,
    );
    expect(ip).toBe("203.0.113.1");
  });

  it("should return first IP from multi-entry X-Forwarded-For", () => {
    const ip = resolveIp(
      { "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" },
      ALL_HEADERS,
    );
    expect(ip).toBe("1.2.3.4");
  });

  it("should trim spaces from X-Forwarded-For entries", () => {
    const ip = resolveIp({ "x-forwarded-for": "  1.2.3.4  " }, ALL_HEADERS);
    expect(ip).toBe("1.2.3.4");
  });

  it("should handle X-Forwarded-For with tab characters around entries", () => {
    const ip = resolveIp({ "x-forwarded-for": "\t10.0.0.1\t, 10.0.0.2" }, ALL_HEADERS);
    expect(ip).toBe("10.0.0.1");
  });

  it("should handle header values with newline characters (trimmed)", () => {
    const ip = resolveIp({ "cf-connecting-ip": "\n10.0.0.1\n" });
    expect(ip).toBe("10.0.0.1");
  });

  it("should handle header with only whitespace and commas in X-Forwarded-For", () => {
    const ip = resolveIp({ "x-forwarded-for": "  ,  ,  " }, ALL_HEADERS);
    expect(ip).toBe("unknown");
  });

  it("should handle X-Forwarded-For with unicode characters", () => {
    const ip = resolveIp({ "x-forwarded-for": "日本語テスト" }, ALL_HEADERS);
    expect(ip).toBe("日本語テスト");
  });

  it("should handle X-Forwarded-For with null byte in string", () => {
    const ip = resolveIp({ "x-forwarded-for": "\x00\x00" }, ALL_HEADERS);
    // null bytes are not whitespace, so the value is returned as-is after trim
    expect(ip).toBe("\x00\x00");
  });
});
