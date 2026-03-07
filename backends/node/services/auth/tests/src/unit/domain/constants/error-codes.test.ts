import { describe, it, expect } from "vitest";
import { AUTH_ERROR_CODES } from "@d2/auth-domain";

describe("AUTH_ERROR_CODES", () => {
  it("all values are prefixed with AUTH_", () => {
    for (const [, value] of Object.entries(AUTH_ERROR_CODES)) {
      expect(value).toMatch(/^AUTH_/);
    }
  });

  it("all values are unique", () => {
    const values = Object.values(AUTH_ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });

  it("contains expected error codes", () => {
    expect(AUTH_ERROR_CODES.SIGN_IN_THROTTLED).toBe("AUTH_SIGN_IN_THROTTLED");
    expect(AUTH_ERROR_CODES.EMAIL_ALREADY_TAKEN).toBe("AUTH_EMAIL_ALREADY_TAKEN");
    expect(AUTH_ERROR_CODES.EMULATION_ORG_TYPE_NOT_ALLOWED).toBe(
      "AUTH_EMULATION_ORG_TYPE_NOT_ALLOWED",
    );
    expect(AUTH_ERROR_CODES.EMULATION_CONSENT_ALREADY_EXISTS).toBe(
      "AUTH_EMULATION_CONSENT_ALREADY_EXISTS",
    );
    expect(AUTH_ERROR_CODES.EMULATION_CONSENT_ALREADY_REVOKED).toBe(
      "AUTH_EMULATION_CONSENT_ALREADY_REVOKED",
    );
    expect(AUTH_ERROR_CODES.ORG_CONTACT_ORG_MISMATCH).toBe("AUTH_ORG_CONTACT_ORG_MISMATCH");
  });

  it("has exactly 6 error codes", () => {
    expect(Object.keys(AUTH_ERROR_CODES)).toHaveLength(6);
  });

  it("is a const object (readonly at compile time)", () => {
    // `as const` makes this readonly at compile time; verify shape is stable
    expect(typeof AUTH_ERROR_CODES).toBe("object");
    expect(AUTH_ERROR_CODES).not.toBeNull();
  });
});
