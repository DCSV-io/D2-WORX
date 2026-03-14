import { describe, it, expect, vi } from "vitest";
import { computeFingerprint, checkSessionFingerprint } from "@d2/session-fingerprint";
import type { CheckSessionFingerprintOptions } from "@d2/session-fingerprint";

// ---------------------------------------------------------------------------
// computeFingerprint
// ---------------------------------------------------------------------------

describe("computeFingerprint", () => {
  it("returns a 64-character hex string", () => {
    const fp = computeFingerprint("Mozilla/5.0", "text/html");

    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same inputs", () => {
    const fp1 = computeFingerprint("Bot/1.0", "application/json");
    const fp2 = computeFingerprint("Bot/1.0", "application/json");

    expect(fp1).toBe(fp2);
  });

  it("produces different hashes for different inputs", () => {
    const fp1 = computeFingerprint("Mozilla/5.0", "text/html");
    const fp2 = computeFingerprint("Chrome/100.0", "text/html");
    const fp3 = computeFingerprint("Mozilla/5.0", "application/json");

    expect(fp1).not.toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp2).not.toBe(fp3);
  });

  it("handles empty strings", () => {
    const fp = computeFingerprint("", "");

    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles unicode characters in user-agent", () => {
    const fp = computeFingerprint("\u65E5\u672C\u8A9E\u30D6\u30E9\u30A6\u30B6/1.0", "text/html");

    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes when only user-agent differs", () => {
    const fp1 = computeFingerprint("Agent-A", "*/*");
    const fp2 = computeFingerprint("Agent-B", "*/*");

    expect(fp1).not.toBe(fp2);
  });

  it("produces different hashes when only accept differs", () => {
    const fp1 = computeFingerprint("Same-Agent", "text/html");
    const fp2 = computeFingerprint("Same-Agent", "application/json");

    expect(fp1).not.toBe(fp2);
  });

  it("handles very long input strings", () => {
    const longUa = "Mozilla/5.0 ".repeat(5000);
    const longAccept = "text/html, ".repeat(5000);
    const fp = computeFingerprint(longUa, longAccept);

    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// checkSessionFingerprint
// ---------------------------------------------------------------------------

describe("checkSessionFingerprint", () => {
  function createOptions(
    overrides: Partial<CheckSessionFingerprintOptions> = {},
  ): CheckSessionFingerprintOptions {
    return {
      storeFingerprint: vi.fn().mockResolvedValue(undefined),
      getFingerprint: vi.fn().mockResolvedValue(null),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it("stores fingerprint on first request (no stored value)", async () => {
    const storeFingerprint = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue(null),
      storeFingerprint,
    });

    const result = await checkSessionFingerprint("session-token-1", "fp-abc", options);

    expect(result).toBeNull();
    expect(storeFingerprint).toHaveBeenCalledWith("session-token-1", "fp-abc");
  });

  it("returns null when fingerprint matches", async () => {
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue("fp-abc"),
    });

    const result = await checkSessionFingerprint("session-token-1", "fp-abc", options);

    expect(result).toBeNull();
  });

  it("returns unauthorized when fingerprint mismatches", async () => {
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue("fp-stored"),
    });

    const result = await checkSessionFingerprint("session-token-1", "fp-different", options);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("revokes session on fingerprint mismatch", async () => {
    const revokeSession = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue("fp-stored"),
      revokeSession,
    });

    await checkSessionFingerprint("session-token-1", "fp-different", options);

    expect(revokeSession).toHaveBeenCalledWith("session-token-1");
  });

  it("fails open when getFingerprint throws (Redis down)", async () => {
    const options = createOptions({
      getFingerprint: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });

    const result = await checkSessionFingerprint("session-token-1", "fp-abc", options);

    expect(result).toBeNull();
  });

  it("continues when storeFingerprint throws", async () => {
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue(null),
      storeFingerprint: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });

    const result = await checkSessionFingerprint("session-token-1", "fp-abc", options);

    // Storage failure on first request — should still return null (fail open)
    expect(result).toBeNull();
  });

  it("does not store fingerprint when one already exists and matches", async () => {
    const storeFingerprint = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue("fp-abc"),
      storeFingerprint,
    });

    await checkSessionFingerprint("session-token-1", "fp-abc", options);

    expect(storeFingerprint).not.toHaveBeenCalled();
  });

  it("still returns unauthorized even if revokeSession throws", async () => {
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue("fp-stored"),
      revokeSession: vi.fn().mockRejectedValue(new Error("revoke failed")),
    });

    const result = await checkSessionFingerprint("session-token-1", "fp-different", options);

    // Even if revocation fails, the request is still rejected
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("does not revoke session when fingerprint matches", async () => {
    const revokeSession = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue("fp-abc"),
      revokeSession,
    });

    await checkSessionFingerprint("session-token-1", "fp-abc", options);

    expect(revokeSession).not.toHaveBeenCalled();
  });

  it("does not revoke session on first request", async () => {
    const revokeSession = vi.fn().mockResolvedValue(undefined);
    const options = createOptions({
      getFingerprint: vi.fn().mockResolvedValue(null),
      revokeSession,
    });

    await checkSessionFingerprint("session-token-1", "fp-abc", options);

    expect(revokeSession).not.toHaveBeenCalled();
  });
});
