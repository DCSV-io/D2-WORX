import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { computeFingerprint } from "@d2/auth-api";

/**
 * Tests for the computeFingerprint export and AsyncLocalStorage integration
 * used to embed the `fp` claim in JWTs.
 */
describe("computeFingerprint (JWT binding)", () => {
  it("should produce a 64-char lowercase hex SHA-256 hash", () => {
    const headers = new Headers({
      "user-agent": "Mozilla/5.0",
      accept: "text/html",
    });
    const result = computeFingerprint(headers);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce consistent output for the same headers", () => {
    const headers1 = new Headers({
      "user-agent": "Mozilla/5.0",
      accept: "text/html",
    });
    const headers2 = new Headers({
      "user-agent": "Mozilla/5.0",
      accept: "text/html",
    });
    expect(computeFingerprint(headers1)).toBe(computeFingerprint(headers2));
  });

  it("should produce different hashes for different User-Agent", () => {
    const h1 = new Headers({ "user-agent": "Chrome/120", accept: "text/html" });
    const h2 = new Headers({ "user-agent": "Firefox/115", accept: "text/html" });
    expect(computeFingerprint(h1)).not.toBe(computeFingerprint(h2));
  });

  it("should produce different hashes for different Accept", () => {
    const h1 = new Headers({ "user-agent": "Chrome/120", accept: "text/html" });
    const h2 = new Headers({ "user-agent": "Chrome/120", accept: "application/json" });
    expect(computeFingerprint(h1)).not.toBe(computeFingerprint(h2));
  });

  it("should handle missing headers with empty string fallback", () => {
    const headers = new Headers();
    const result = computeFingerprint(headers);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
    // Should be SHA-256 of "|" (empty UA + "|" + empty Accept)
    const expected = createHash("sha256").update("|", "utf8").digest("hex");
    expect(result).toBe(expected);
  });

  it("should match the expected SHA-256 formula: SHA-256(UA + '|' + Accept)", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
    const accept = "text/html,application/xhtml+xml";
    const headers = new Headers({ "user-agent": ua, accept });
    const result = computeFingerprint(headers);
    const expected = createHash("sha256").update(`${ua}|${accept}`, "utf8").digest("hex");
    expect(result).toBe(expected);
  });
});

describe("AsyncLocalStorage fingerprint integration", () => {
  it("should store and retrieve fingerprint across async boundaries", async () => {
    const storage = new AsyncLocalStorage<string>();
    let retrieved: string | undefined;

    await storage.run("test-fingerprint", async () => {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 1));
      retrieved = storage.getStore();
    });

    expect(retrieved).toBe("test-fingerprint");
  });

  it("should return undefined when not inside a run context", () => {
    const storage = new AsyncLocalStorage<string>();
    expect(storage.getStore()).toBeUndefined();
  });

  it("should isolate concurrent requests", async () => {
    const storage = new AsyncLocalStorage<string>();
    const results: string[] = [];

    await Promise.all([
      storage.run("fp-a", async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        results.push(`a:${storage.getStore()}`);
      }),
      storage.run("fp-b", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        results.push(`b:${storage.getStore()}`);
      }),
    ]);

    expect(results).toContain("a:fp-a");
    expect(results).toContain("b:fp-b");
  });
});
