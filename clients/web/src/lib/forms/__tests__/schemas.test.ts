import { describe, it, expect } from "vitest";
import {
  nameField,
  emailField,
  phoneField,
  phoneFieldOptional,
  postcodeField,
  streetField,
  urlField,
  currencyField,
} from "../schemas.js";

describe("nameField", () => {
  const schema = nameField();

  it("accepts valid names", () => {
    expect(schema.safeParse("Jane").success).toBe(true);
    expect(schema.safeParse("O'Brien").success).toBe(true);
    expect(schema.safeParse("San Francisco").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(schema.safeParse("").success).toBe(false);
  });

  it("rejects string exceeding default max (100)", () => {
    expect(schema.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("respects custom max length", () => {
    const short = nameField(10);
    expect(short.safeParse("a".repeat(10)).success).toBe(true);
    expect(short.safeParse("a".repeat(11)).success).toBe(false);
  });
});

describe("emailField", () => {
  const schema = emailField();

  it("accepts valid emails", () => {
    expect(schema.safeParse("user@example.com").success).toBe(true);
    expect(schema.safeParse("user+tag@sub.domain.com").success).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(schema.safeParse("not-an-email").success).toBe(false);
    expect(schema.safeParse("@missing-local.com").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(schema.safeParse("").success).toBe(false);
  });

  it("rejects overly long emails", () => {
    expect(schema.safeParse("a".repeat(250) + "@x.com").success).toBe(false);
  });
});

describe("phoneField", () => {
  const schema = phoneField();

  it("accepts valid E.164 numbers", () => {
    expect(schema.safeParse("+12025551234").success).toBe(true);
    expect(schema.safeParse("+442071234567").success).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(schema.safeParse("12345").success).toBe(false);
    expect(schema.safeParse("not-a-number").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(schema.safeParse("").success).toBe(false);
  });
});

describe("phoneFieldOptional", () => {
  const schema = phoneFieldOptional();

  it("accepts empty string", () => {
    expect(schema.safeParse("").success).toBe(true);
  });

  it("accepts valid number", () => {
    expect(schema.safeParse("+12025551234").success).toBe(true);
  });

  it("rejects invalid non-empty string", () => {
    expect(schema.safeParse("abc").success).toBe(false);
  });
});

describe("postcodeField", () => {
  it("accepts any non-empty string without country", () => {
    const schema = postcodeField();
    expect(schema.safeParse("12345").success).toBe(true);
    expect(schema.safeParse("K1A 0B1").success).toBe(true);
  });

  it("rejects empty string", () => {
    const schema = postcodeField();
    expect(schema.safeParse("").success).toBe(false);
  });

  it("validates US postal codes", () => {
    const schema = postcodeField("US");
    expect(schema.safeParse("12345").success).toBe(true);
    expect(schema.safeParse("12345-6789").success).toBe(true);
    expect(schema.safeParse("ABCDE").success).toBe(false);
  });

  it("validates CA postal codes", () => {
    const schema = postcodeField("CA");
    expect(schema.safeParse("K1A 0B1").success).toBe(true);
    expect(schema.safeParse("12345").success).toBe(false);
  });
});

describe("streetField", () => {
  const schema = streetField();

  it("accepts valid addresses", () => {
    expect(schema.safeParse("123 Main St").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(schema.safeParse("").success).toBe(false);
  });

  it("respects max length", () => {
    expect(schema.safeParse("a".repeat(201)).success).toBe(false);
  });
});

describe("urlField", () => {
  const schema = urlField();

  it("accepts valid URLs", () => {
    expect(schema.safeParse("https://example.com").success).toBe(true);
  });

  it("accepts empty string (optional)", () => {
    expect(schema.safeParse("").success).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(schema.safeParse("not a url").success).toBe(false);
  });
});

describe("currencyField", () => {
  const schema = currencyField();

  it("accepts valid ISO 4217 codes", () => {
    expect(schema.safeParse("USD").success).toBe(true);
    expect(schema.safeParse("EUR").success).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(schema.safeParse("usd").success).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(schema.safeParse("US").success).toBe(false);
    expect(schema.safeParse("USDX").success).toBe(false);
  });
});
