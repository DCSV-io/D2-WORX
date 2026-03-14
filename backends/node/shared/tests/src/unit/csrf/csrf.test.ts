import { describe, it, expect } from "vitest";
import { validateCsrf, normalizeOrigins } from "@d2/csrf";

// ---------------------------------------------------------------------------
// validateCsrf
// ---------------------------------------------------------------------------

describe("validateCsrf", () => {
  it("returns null for safe methods (GET, HEAD, OPTIONS)", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    expect(validateCsrf("GET", undefined, undefined, undefined, allowedOrigins)).toBeNull();
    expect(validateCsrf("HEAD", undefined, undefined, undefined, allowedOrigins)).toBeNull();
    expect(validateCsrf("OPTIONS", undefined, undefined, undefined, allowedOrigins)).toBeNull();
  });

  it("returns null for unsafe method with valid content-type", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "POST",
      "application/json",
      undefined,
      "https://example.com",
      allowedOrigins,
    );

    expect(result).toBeNull();
  });

  it("returns null for unsafe method with X-Requested-With header", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "POST",
      undefined,
      "XMLHttpRequest",
      "https://example.com",
      allowedOrigins,
    );

    expect(result).toBeNull();
  });

  it("returns forbidden when unsafe method lacks content-type and x-requested-with", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "POST",
      undefined,
      undefined,
      "https://example.com",
      allowedOrigins,
    );

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it("returns null when origin matches allowed origin", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "POST",
      "application/json",
      undefined,
      "https://example.com",
      allowedOrigins,
    );

    expect(result).toBeNull();
  });

  it("returns forbidden when origin does not match allowed origins", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "POST",
      "application/json",
      undefined,
      "https://evil.com",
      allowedOrigins,
    );

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it("returns null when no origin header present (same-origin)", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf("POST", "application/json", undefined, undefined, allowedOrigins);

    expect(result).toBeNull();
  });

  it("strips trailing slashes when comparing origins", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "POST",
      "application/json",
      undefined,
      "https://example.com/",
      allowedOrigins,
    );

    expect(result).toBeNull();
  });

  it("returns forbidden for PUT without content-type or custom header", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf("PUT", undefined, undefined, "https://example.com", allowedOrigins);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it("returns forbidden for DELETE without content-type or custom header", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "DELETE",
      undefined,
      undefined,
      "https://example.com",
      allowedOrigins,
    );

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it("returns forbidden for PATCH without content-type or custom header", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "PATCH",
      undefined,
      undefined,
      "https://example.com",
      allowedOrigins,
    );

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it("accepts content-type with charset suffix", () => {
    const allowedOrigins = new Set(["https://example.com"]);

    const result = validateCsrf(
      "POST",
      "application/json; charset=utf-8",
      undefined,
      undefined,
      allowedOrigins,
    );

    expect(result).toBeNull();
  });

  it("returns null for empty allowed origins when no origin header is sent", () => {
    const allowedOrigins = new Set<string>();

    const result = validateCsrf("POST", "application/json", undefined, undefined, allowedOrigins);

    expect(result).toBeNull();
  });

  it("returns forbidden when origin sent but allowed origins is empty", () => {
    const allowedOrigins = new Set<string>();

    const result = validateCsrf(
      "POST",
      "application/json",
      undefined,
      "https://anything.com",
      allowedOrigins,
    );

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(403);
  });

  it("matches against multiple allowed origins", () => {
    const allowedOrigins = new Set(["https://a.com", "https://b.com", "https://c.com"]);

    expect(
      validateCsrf("POST", "application/json", undefined, "https://b.com", allowedOrigins),
    ).toBeNull();
    expect(
      validateCsrf("POST", "application/json", undefined, "https://c.com", allowedOrigins),
    ).toBeNull();
    expect(
      validateCsrf("POST", "application/json", undefined, "https://d.com", allowedOrigins),
    ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeOrigins
// ---------------------------------------------------------------------------

describe("normalizeOrigins", () => {
  it("strips trailing slashes from origins", () => {
    const result = normalizeOrigins(["https://example.com/", "https://other.com//"]);

    expect(result.has("https://example.com")).toBe(true);
    expect(result.has("https://other.com")).toBe(true);
  });

  it("returns a Set", () => {
    const result = normalizeOrigins(["https://example.com"]);

    expect(result).toBeInstanceOf(Set);
  });

  it("handles empty array", () => {
    const result = normalizeOrigins([]);

    expect(result.size).toBe(0);
  });

  it("deduplicates origins after normalization", () => {
    const result = normalizeOrigins(["https://example.com", "https://example.com/"]);

    expect(result.size).toBe(1);
    expect(result.has("https://example.com")).toBe(true);
  });

  it("preserves origins without trailing slashes", () => {
    const result = normalizeOrigins(["https://example.com", "https://other.com"]);

    expect(result.size).toBe(2);
    expect(result.has("https://example.com")).toBe(true);
    expect(result.has("https://other.com")).toBe(true);
  });
});
