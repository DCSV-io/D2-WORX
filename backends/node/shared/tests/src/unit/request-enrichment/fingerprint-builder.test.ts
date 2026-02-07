import { describe, it, expect } from "vitest";
import { buildServerFingerprint } from "@d2/request-enrichment";

describe("buildServerFingerprint", () => {
  const typicalHeaders = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    accept: "text/html,application/xhtml+xml",
  };

  it("should return a 64-character lowercase hex string", () => {
    const fp = buildServerFingerprint(typicalHeaders);
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should be deterministic (same input -> same hash)", () => {
    const fp1 = buildServerFingerprint(typicalHeaders);
    const fp2 = buildServerFingerprint(typicalHeaders);
    expect(fp1).toBe(fp2);
  });

  it("should produce different hash for different user-agent", () => {
    const fp1 = buildServerFingerprint(typicalHeaders);
    const fp2 = buildServerFingerprint({
      ...typicalHeaders,
      "user-agent": "curl/7.68.0",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("should produce different hash for different accept-language", () => {
    const fp1 = buildServerFingerprint(typicalHeaders);
    const fp2 = buildServerFingerprint({
      ...typicalHeaders,
      "accept-language": "fr-FR",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("should produce different hash for different accept-encoding", () => {
    const fp1 = buildServerFingerprint(typicalHeaders);
    const fp2 = buildServerFingerprint({
      ...typicalHeaders,
      "accept-encoding": "identity",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("should produce different hash for different accept", () => {
    const fp1 = buildServerFingerprint(typicalHeaders);
    const fp2 = buildServerFingerprint({
      ...typicalHeaders,
      accept: "application/json",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("should produce valid hash when all headers are missing", () => {
    const fp = buildServerFingerprint({});
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should handle array-valued headers (uses first element)", () => {
    const fp = buildServerFingerprint({
      "user-agent": ["Mozilla/5.0", "curl/7.68.0"],
      "accept-language": ["en-US"],
      "accept-encoding": ["gzip"],
      accept: ["text/html"],
    });
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should handle empty array headers (falls back to empty string)", () => {
    const fpEmpty = buildServerFingerprint({ "user-agent": [] });
    const fpMissing = buildServerFingerprint({});
    // Both should produce the same hash since empty array falls back to ""
    expect(fpEmpty).toBe(fpMissing);
  });
});
