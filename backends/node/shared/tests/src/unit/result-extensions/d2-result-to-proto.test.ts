import { describe, it, expect } from "vitest";
import { D2Result, ErrorCodes, HttpStatusCode, type InputError } from "@d2/result";
import { d2ResultToProto, d2ResultFromProto } from "@d2/result-extensions";

// ---------------------------------------------------------------------------
// Success conversions
// ---------------------------------------------------------------------------

describe("d2ResultToProto — success", () => {
  it("converts a success result with defaults", () => {
    const result = D2Result.ok();

    const proto = d2ResultToProto(result);

    expect(proto.success).toBe(true);
    expect(proto.statusCode).toBe(HttpStatusCode.OK);
    expect(proto.errorCode).toBe("");
    expect(proto.traceId).toBe("");
    expect(proto.messages).toEqual([]);
    expect(proto.inputErrors).toEqual([]);
  });

  it("converts a success result with traceId", () => {
    const result = D2Result.ok({ traceId: "trace-abc" });

    const proto = d2ResultToProto(result);

    expect(proto.success).toBe(true);
    expect(proto.traceId).toBe("trace-abc");
  });

  it("converts a success result with messages", () => {
    const result = D2Result.ok({ messages: ["Item created.", "Cache updated."] });

    const proto = d2ResultToProto(result);

    expect(proto.messages).toEqual(["Item created.", "Cache updated."]);
  });
});

// ---------------------------------------------------------------------------
// Failure conversions
// ---------------------------------------------------------------------------

describe("d2ResultToProto — failure", () => {
  it("converts a failure result preserving all fields", () => {
    const result = D2Result.fail({
      messages: ["Something went wrong."],
      statusCode: HttpStatusCode.ServiceUnavailable,
      errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
      traceId: "trace-123",
    });

    const proto = d2ResultToProto(result);

    expect(proto.success).toBe(false);
    expect(proto.statusCode).toBe(HttpStatusCode.ServiceUnavailable);
    expect(proto.errorCode).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
    expect(proto.traceId).toBe("trace-123");
    expect(proto.messages).toEqual(["Something went wrong."]);
  });

  it("converts null errorCode to empty string", () => {
    const result = D2Result.fail();

    const proto = d2ResultToProto(result);

    expect(proto.errorCode).toBe("");
  });

  it("converts null traceId to empty string", () => {
    const result = D2Result.fail();

    const proto = d2ResultToProto(result);

    expect(proto.traceId).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Input errors
// ---------------------------------------------------------------------------

describe("d2ResultToProto — input errors", () => {
  it("converts input errors from tuple format to proto format", () => {
    const inputErrors: InputError[] = [
      ["email", "Email is required.", "Email must be valid."],
      ["password", "Password is required."],
    ];
    const result = D2Result.validationFailed({ inputErrors });

    const proto = d2ResultToProto(result);

    expect(proto.inputErrors).toHaveLength(2);
    expect(proto.inputErrors[0]).toEqual({
      field: "email",
      errors: ["Email is required.", "Email must be valid."],
    });
    expect(proto.inputErrors[1]).toEqual({
      field: "password",
      errors: ["Password is required."],
    });
  });

  it("preserves empty input errors array", () => {
    const result = D2Result.fail();

    const proto = d2ResultToProto(result);

    expect(proto.inputErrors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Data exclusion (proto does not carry data — data travels in separate fields)
// ---------------------------------------------------------------------------

describe("d2ResultToProto — data exclusion", () => {
  it("does not include data in proto (data is carried separately in gRPC responses)", () => {
    const result = D2Result.ok({ data: { id: 42, name: "test" } });

    const proto = d2ResultToProto(result);

    // Proto should only carry result metadata, not the data payload
    expect(proto).not.toHaveProperty("data");
    expect(proto.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round-trip (toProto -> fromProto preserves all result metadata)
// ---------------------------------------------------------------------------

describe("d2ResultToProto + d2ResultFromProto — round-trip", () => {
  it("preserves success result metadata through round-trip", () => {
    const original = D2Result.ok({ messages: ["Created."], traceId: "trace-rt" });

    const restored = d2ResultFromProto(d2ResultToProto(original));

    expect(restored.success).toBe(original.success);
    expect(restored.statusCode).toBe(original.statusCode);
    expect([...restored.messages]).toEqual([...original.messages]);
    expect(restored.traceId).toBe(original.traceId);
    expect(restored.errorCode).toBe(original.errorCode);
    expect(restored.inputErrors).toHaveLength(0);
  });

  it("preserves failure result metadata through round-trip", () => {
    const inputErrors: InputError[] = [
      ["email", "Required.", "Must be valid."],
      ["name", "Too short."],
    ];
    const original = D2Result.fail({
      messages: ["Validation failed."],
      statusCode: HttpStatusCode.BadRequest,
      errorCode: ErrorCodes.VALIDATION_FAILED,
      inputErrors,
      traceId: "trace-rt-fail",
    });

    const restored = d2ResultFromProto(d2ResultToProto(original));

    expect(restored.success).toBe(original.success);
    expect(restored.statusCode).toBe(original.statusCode);
    expect([...restored.messages]).toEqual([...original.messages]);
    expect(restored.errorCode).toBe(original.errorCode);
    expect(restored.traceId).toBe(original.traceId);
    expect(restored.inputErrors).toHaveLength(2);
    expect(restored.inputErrors[0]).toEqual(["email", "Required.", "Must be valid."]);
    expect(restored.inputErrors[1]).toEqual(["name", "Too short."]);
  });
});
