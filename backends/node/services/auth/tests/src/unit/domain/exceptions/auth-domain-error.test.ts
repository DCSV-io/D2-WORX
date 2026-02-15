import { describe, it, expect } from "vitest";
import { AuthDomainError } from "@d2/auth-domain";

describe("AuthDomainError", () => {
  it("should set message correctly", () => {
    const error = new AuthDomainError("something went wrong");
    expect(error.message).toBe("something went wrong");
  });

  it("should set name to AuthDomainError", () => {
    const error = new AuthDomainError("test");
    expect(error.name).toBe("AuthDomainError");
  });

  it("should be an instance of Error", () => {
    const error = new AuthDomainError("test");
    expect(error).toBeInstanceOf(Error);
  });

  it("should support cause chaining", () => {
    const cause = new Error("root cause");
    const error = new AuthDomainError("wrapper", { cause });
    expect(error.cause).toBe(cause);
  });

  it("should have a stack trace", () => {
    const error = new AuthDomainError("test");
    expect(error.stack).toBeDefined();
  });
});
