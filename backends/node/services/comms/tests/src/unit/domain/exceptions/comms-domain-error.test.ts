import { describe, it, expect } from "vitest";
import { CommsDomainError } from "@d2/comms-domain";

describe("CommsDomainError", () => {
  it("should set the message correctly", () => {
    const error = new CommsDomainError("something went wrong");
    expect(error.message).toBe("something went wrong");
  });

  it("should set name to CommsDomainError", () => {
    const error = new CommsDomainError("test");
    expect(error.name).toBe("CommsDomainError");
  });

  it("should be an instance of Error", () => {
    const error = new CommsDomainError("test");
    expect(error).toBeInstanceOf(Error);
  });

  it("should support error cause via options", () => {
    const cause = new Error("root cause");
    const error = new CommsDomainError("wrapper", { cause });
    expect(error.cause).toBe(cause);
  });
});
