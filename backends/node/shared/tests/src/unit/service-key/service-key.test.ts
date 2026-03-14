import { describe, it, expect } from "vitest";
import { validateServiceKey } from "@d2/service-key";

// ---------------------------------------------------------------------------
// validateServiceKey
// ---------------------------------------------------------------------------

describe("validateServiceKey", () => {
  it("returns null for a valid key", () => {
    const result = validateServiceKey("my-secret-key", ["my-secret-key"]);

    expect(result).toBeNull();
  });

  it("returns unauthorized for an invalid key", () => {
    const result = validateServiceKey("wrong-key", ["correct-key"]);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("returns unauthorized for an empty key", () => {
    const result = validateServiceKey("", ["valid-key"]);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("returns unauthorized when validKeys is empty", () => {
    const result = validateServiceKey("any-key", []);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("matches against multiple valid keys", () => {
    const validKeys = ["key-alpha", "key-beta", "key-gamma"];

    expect(validateServiceKey("key-alpha", validKeys)).toBeNull();
    expect(validateServiceKey("key-beta", validKeys)).toBeNull();
    expect(validateServiceKey("key-gamma", validKeys)).toBeNull();
    expect(validateServiceKey("key-delta", validKeys)).not.toBeNull();
  });

  it("is case-sensitive", () => {
    const result = validateServiceKey("My-Secret-Key", ["my-secret-key"]);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("handles keys of different lengths", () => {
    // timingSafeEqual requires equal-length buffers — different lengths should not match
    const result = validateServiceKey("short", ["a-much-longer-key-value"]);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("rejects key that is a prefix of a valid key", () => {
    const result = validateServiceKey("my-secret", ["my-secret-key"]);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("rejects key that is a suffix of a valid key", () => {
    const result = validateServiceKey("secret-key", ["my-secret-key"]);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("handles unicode characters in keys", () => {
    const result = validateServiceKey("\u00FCber-key-\u00E9\u00E8\u00EA", [
      "\u00FCber-key-\u00E9\u00E8\u00EA",
    ]);

    expect(result).toBeNull();
  });

  it("rejects whitespace-padded key", () => {
    const result = validateServiceKey(" my-secret-key ", ["my-secret-key"]);

    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(401);
  });

  it("iterates all valid keys even after a length mismatch", () => {
    // The function should always iterate ALL keys to prevent timing leaks.
    // If key-c matches but key-a and key-b are different lengths, it should still match.
    const validKeys = ["short", "medium-length", "my-secret-key"];

    expect(validateServiceKey("my-secret-key", validKeys)).toBeNull();
  });

  it("returns the correct error message when validKeys is empty", () => {
    const result = validateServiceKey("key", []);

    expect(result).not.toBeNull();
    expect(result!.messages).toContain("Service key validation not configured.");
  });

  it("returns the correct error message for invalid key", () => {
    const result = validateServiceKey("wrong", ["correct"]);

    expect(result).not.toBeNull();
    expect(result!.messages).toContain("Invalid API key.");
  });
});
