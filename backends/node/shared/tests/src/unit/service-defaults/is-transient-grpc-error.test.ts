import { describe, it, expect } from "vitest";
import { isTransientGrpcError } from "@d2/service-defaults/grpc";

describe("isTransientGrpcError", () => {
  // gRPC transient codes
  it("returns true for gRPC DEADLINE_EXCEEDED (code 4)", () => {
    expect(isTransientGrpcError({ code: 4 })).toBe(true);
  });

  it("returns true for gRPC RESOURCE_EXHAUSTED (code 8)", () => {
    expect(isTransientGrpcError({ code: 8 })).toBe(true);
  });

  it("returns true for gRPC ABORTED (code 10)", () => {
    expect(isTransientGrpcError({ code: 10 })).toBe(true);
  });

  it("returns true for gRPC INTERNAL (code 13)", () => {
    expect(isTransientGrpcError({ code: 13 })).toBe(true);
  });

  it("returns true for gRPC UNAVAILABLE (code 14)", () => {
    expect(isTransientGrpcError({ code: 14, details: "unavailable" })).toBe(true);
  });

  // Non-transient gRPC codes
  it("returns false for gRPC OK (code 0)", () => {
    expect(isTransientGrpcError({ code: 0 })).toBe(false);
  });

  it("returns false for gRPC NOT_FOUND (code 5)", () => {
    expect(isTransientGrpcError({ code: 5 })).toBe(false);
  });

  it("returns false for gRPC PERMISSION_DENIED (code 7)", () => {
    expect(isTransientGrpcError({ code: 7 })).toBe(false);
  });

  it("returns false for gRPC UNAUTHENTICATED (code 16)", () => {
    expect(isTransientGrpcError({ code: 16 })).toBe(false);
  });

  // Delegates to generic isTransientError for connection/timeout patterns
  it("returns true for ECONNREFUSED (generic pattern)", () => {
    expect(isTransientGrpcError(new Error("connect ECONNREFUSED 127.0.0.1:50051"))).toBe(true);
  });

  it("returns true for timeout (generic pattern)", () => {
    expect(isTransientGrpcError(new Error("Operation timeout after 5000ms"))).toBe(true);
  });

  it("returns true for ECONNRESET (generic pattern)", () => {
    expect(isTransientGrpcError(new Error("socket hang up ECONNRESET"))).toBe(true);
  });

  // Edge cases
  it("returns false for null", () => {
    expect(isTransientGrpcError(null)).toBe(false);
  });

  it("returns false for a regular Error", () => {
    expect(isTransientGrpcError(new Error("some validation error"))).toBe(false);
  });

  it("returns false for AbortError", () => {
    const err = new DOMException("The operation was aborted", "AbortError");
    expect(isTransientGrpcError(err)).toBe(false);
  });
});
