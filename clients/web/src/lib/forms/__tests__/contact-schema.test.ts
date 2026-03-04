import { describe, it, expect } from "vitest";
import { contactSchema, type ContactFormData } from "../../../routes/design/contact-form/schema.js";

/** Minimal valid form data — all required fields filled. */
function validData(overrides: Partial<ContactFormData> = {}): Record<string, unknown> {
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "+12025551234",
    country: "US",
    state: "",
    street1: "123 Main St",
    street2: "",
    street3: "",
    city: "San Francisco",
    postalCode: "94102",
    ...overrides,
  };
}

describe("contactSchema — basic validation", () => {
  it("accepts fully valid data", () => {
    const result = contactSchema.safeParse(validData());
    expect(result.success).toBe(true);
  });

  it("rejects missing firstName", () => {
    const result = contactSchema.safeParse(validData({ firstName: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing lastName", () => {
    const result = contactSchema.safeParse(validData({ lastName: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = contactSchema.safeParse(validData({ email: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = contactSchema.safeParse(validData({ email: "noemail" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing phone", () => {
    const result = contactSchema.safeParse(validData({ phone: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects invalid phone", () => {
    const result = contactSchema.safeParse(validData({ phone: "12345" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing country", () => {
    const result = contactSchema.safeParse(validData({ country: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing street1", () => {
    const result = contactSchema.safeParse(validData({ street1: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing city", () => {
    const result = contactSchema.safeParse(validData({ city: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects missing postalCode", () => {
    const result = contactSchema.safeParse(validData({ postalCode: "" }));
    expect(result.success).toBe(false);
  });

  it("accepts optional state as empty string", () => {
    const result = contactSchema.safeParse(validData({ state: "" }));
    expect(result.success).toBe(true);
  });

  it("accepts optional street2 as empty string", () => {
    const result = contactSchema.safeParse(validData({ street2: "" }));
    expect(result.success).toBe(true);
  });
});

describe("contactSchema — whitespace-only inputs rejected", () => {
  it("rejects whitespace-only firstName", () => {
    const result = contactSchema.safeParse(validData({ firstName: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only lastName", () => {
    const result = contactSchema.safeParse(validData({ lastName: " \t " }));
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only email", () => {
    const result = contactSchema.safeParse(validData({ email: "  " }));
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only country", () => {
    const result = contactSchema.safeParse(validData({ country: "  " }));
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only street1", () => {
    const result = contactSchema.safeParse(validData({ street1: "   " }));
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only city", () => {
    const result = contactSchema.safeParse(validData({ city: "  " }));
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only postalCode", () => {
    const result = contactSchema.safeParse(validData({ postalCode: " " }));
    expect(result.success).toBe(false);
  });

  it("trims valid values (leading/trailing spaces removed)", () => {
    const result = contactSchema.safeParse(validData({ firstName: "  Jane  " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Jane");
    }
  });
});

describe("contactSchema — cross-field: street2/street3 dependency", () => {
  it("allows street2 with street1 present", () => {
    const result = contactSchema.safeParse(validData({ street1: "123 Main", street2: "Apt 4B" }));
    expect(result.success).toBe(true);
  });

  it("allows street3 when both street1 and street2 present", () => {
    const result = contactSchema.safeParse(
      validData({ street1: "123 Main", street2: "Apt 4B", street3: "Floor 2" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects street3 when street2 is empty", () => {
    const result = contactSchema.safeParse(
      validData({ street1: "123 Main", street2: "", street3: "Floor 2" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const street2Errors = result.error.issues.filter((i) => i.path.includes("street2"));
      expect(street2Errors.length).toBeGreaterThan(0);
      expect(street2Errors[0].message).toContain("Address Line 2 is required");
    }
  });

  it("rejects street2 when street1 is empty", () => {
    const result = contactSchema.safeParse(validData({ street1: "", street2: "Apt 4B" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const street1Errors = result.error.issues.filter((i) => i.path.includes("street1"));
      expect(street1Errors.length).toBeGreaterThan(0);
    }
  });

  it("rejects street3 when street1 is empty (both refinements fail)", () => {
    const result = contactSchema.safeParse(
      validData({ street1: "", street2: "Apt 4B", street3: "Floor 2" }),
    );
    expect(result.success).toBe(false);
  });

  it("allows all street fields empty (only street1 required by base schema)", () => {
    // street1 is required by streetField(), so empty street1 fails
    const result = contactSchema.safeParse(
      validData({ street1: "", street2: "", street3: "" }),
    );
    expect(result.success).toBe(false); // street1 required
  });

  it("whitespace-only street3 is treated as empty (no cross-field error)", () => {
    const result = contactSchema.safeParse(
      validData({ street1: "123 Main", street2: "", street3: "   " }),
    );
    // street3 is trimmed to "" → refine(!d.street3 || d.street2) → !("") = true → passes
    expect(result.success).toBe(true);
  });

  it("whitespace-only street2 is treated as empty (triggers cross-field if street3 present)", () => {
    const result = contactSchema.safeParse(
      validData({ street1: "123 Main", street2: "   ", street3: "Floor 2" }),
    );
    // street2 trimmed to "" → refine(!d.street3 || d.street2) → !"Floor 2" = false, d.street2 = "" (falsy) → FAILS
    expect(result.success).toBe(false);
  });
});

describe("contactSchema — max length enforcement", () => {
  it("rejects street2 exceeding 200 chars", () => {
    const result = contactSchema.safeParse(
      validData({ street1: "123 Main", street2: "a".repeat(201) }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects street3 exceeding 200 chars", () => {
    const result = contactSchema.safeParse(
      validData({ street1: "123 Main", street2: "Apt", street3: "a".repeat(201) }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects postalCode exceeding 20 chars", () => {
    const result = contactSchema.safeParse(validData({ postalCode: "1".repeat(21) }));
    expect(result.success).toBe(false);
  });
});
