import { describe, it, expect } from "vitest";
import { AuthValidationError, AuthDomainError } from "@d2/auth-domain";

describe("AuthValidationError", () => {
  it("should format the message correctly", () => {
    const error = new AuthValidationError("User", "email", "bad", "is required.");
    expect(error.message).toBe("Validation failed for User.email with value 'bad': is required.");
  });

  it("should store structured properties", () => {
    const error = new AuthValidationError("Organization", "slug", "", "cannot be empty.");
    expect(error.entityName).toBe("Organization");
    expect(error.propertyName).toBe("slug");
    expect(error.invalidValue).toBe("");
    expect(error.reason).toBe("cannot be empty.");
  });

  it("should handle null invalidValue in message", () => {
    const error = new AuthValidationError("User", "name", null, "is required.");
    expect(error.message).toBe("Validation failed for User.name with value 'null': is required.");
    expect(error.invalidValue).toBeNull();
  });

  it("should handle undefined invalidValue in message", () => {
    const error = new AuthValidationError("User", "name", undefined, "is required.");
    expect(error.message).toBe(
      "Validation failed for User.name with value 'undefined': is required.",
    );
    expect(error.invalidValue).toBeUndefined();
  });

  it("should set name to AuthValidationError", () => {
    const error = new AuthValidationError("User", "email", "x", "invalid");
    expect(error.name).toBe("AuthValidationError");
  });

  it("should be an instance of AuthDomainError", () => {
    const error = new AuthValidationError("User", "email", "x", "invalid");
    expect(error).toBeInstanceOf(AuthDomainError);
  });

  it("should be an instance of Error", () => {
    const error = new AuthValidationError("User", "email", "x", "invalid");
    expect(error).toBeInstanceOf(Error);
  });
});
