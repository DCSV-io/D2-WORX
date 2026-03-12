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

});
