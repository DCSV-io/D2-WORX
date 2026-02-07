import { describe, it, expect } from "vitest";
import { resolveIp, isLocalhost } from "@d2/request-enrichment";

describe("resolveIp", () => {
  it("should return cf-connecting-ip when present", () => {
    const ip = resolveIp({
      "cf-connecting-ip": "1.2.3.4",
      "x-real-ip": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12",
    });
    expect(ip).toBe("1.2.3.4");
  });

  it("should return x-real-ip when cf-connecting-ip is absent", () => {
    const ip = resolveIp({
      "x-real-ip": "5.6.7.8",
      "x-forwarded-for": "9.10.11.12",
    });
    expect(ip).toBe("5.6.7.8");
  });

  it("should return first entry from x-forwarded-for when higher-priority headers absent", () => {
    const ip = resolveIp({
      "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3",
    });
    expect(ip).toBe("1.1.1.1");
  });

  it("should trim whitespace from x-forwarded-for entries", () => {
    const ip = resolveIp({
      "x-forwarded-for": "  4.4.4.4  , 5.5.5.5",
    });
    expect(ip).toBe("4.4.4.4");
  });

  it("should skip empty entries in x-forwarded-for", () => {
    const ip = resolveIp({
      "x-forwarded-for": " , , 6.6.6.6",
    });
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
    const ip = resolveIp({
      "cf-connecting-ip": "",
      "x-real-ip": "7.7.7.7",
    });
    expect(ip).toBe("7.7.7.7");
  });

  it("should skip whitespace-only cf-connecting-ip and fall through", () => {
    const ip = resolveIp({
      "cf-connecting-ip": "   ",
      "x-real-ip": "8.8.8.8",
    });
    expect(ip).toBe("8.8.8.8");
  });

  it("should preserve IPv4-mapped IPv6 addresses as-is", () => {
    const ip = resolveIp({
      "x-real-ip": "::ffff:192.168.1.1",
    });
    expect(ip).toBe("::ffff:192.168.1.1");
  });

  it("should trim x-real-ip", () => {
    const ip = resolveIp({
      "x-real-ip": "  9.9.9.9  ",
    });
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
    const ip = resolveIp({
      "cf-connecting-ip": [],
      "x-real-ip": "11.11.11.11",
    });
    expect(ip).toBe("11.11.11.11");
  });

  it("should handle x-forwarded-for as array (uses first element)", () => {
    const ip = resolveIp({
      "x-forwarded-for": ["12.12.12.12, 13.13.13.13", "14.14.14.14"],
    });
    expect(ip).toBe("12.12.12.12");
  });

  it("should return 'unknown' when x-forwarded-for has only commas", () => {
    const ip = resolveIp({
      "x-forwarded-for": ",",
    });
    expect(ip).toBe("unknown");
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
