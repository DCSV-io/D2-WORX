import { describe, it, expect } from "vitest";
import { HttpStatusCode, ErrorCodes } from "@d2/result";
import { D2ResultProtoFns, InputErrorProtoFns } from "@d2/protos";
import { d2ResultFromProto } from "@d2/result-extensions";

// ---------------------------------------------------------------------------
// Success conversions
// ---------------------------------------------------------------------------

describe("d2ResultFromProto — success", () => {
  it("converts a success proto to D2Result", () => {
    const proto = D2ResultProtoFns.create({
      success: true,
      statusCode: HttpStatusCode.OK,
      errorCode: "",
      traceId: "",
      messages: [],
      inputErrors: [],
    });

    const result = d2ResultFromProto(proto);

    expect(result).toBeSuccess();
    expect(result).toHaveStatusCode(HttpStatusCode.OK);
    expect(result.errorCode).toBeUndefined();
    expect(result.traceId).toBeUndefined();
    expect(result.messages).toHaveLength(0);
    expect(result.inputErrors).toHaveLength(0);
    expect(result.data).toBeUndefined();
  });

  it("injects data parameter into result", () => {
    const proto = D2ResultProtoFns.create({
      success: true,
      statusCode: HttpStatusCode.OK,
    });
    const data = { id: 42, name: "test" };

    const result = d2ResultFromProto(proto, data);

    expect(result).toBeSuccess();
    expect(result).toHaveData(data);
  });

  it("converts non-empty traceId", () => {
    const proto = D2ResultProtoFns.create({
      success: true,
      statusCode: HttpStatusCode.OK,
      traceId: "trace-xyz",
    });

    const result = d2ResultFromProto(proto);

    expect(result.traceId).toBe("trace-xyz");
  });
});

// ---------------------------------------------------------------------------
// Failure conversions
// ---------------------------------------------------------------------------

describe("d2ResultFromProto — failure", () => {
  it("converts a failure proto preserving all error details", () => {
    const proto = D2ResultProtoFns.create({
      success: false,
      statusCode: HttpStatusCode.ServiceUnavailable,
      errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
      traceId: "trace-456",
      messages: ["Service is unavailable."],
    });

    const result = d2ResultFromProto(proto);

    expect(result).toBeFailure();
    expect(result).toHaveStatusCode(HttpStatusCode.ServiceUnavailable);
    expect(result).toHaveErrorCode(ErrorCodes.SERVICE_UNAVAILABLE);
    expect(result.traceId).toBe("trace-456");
    expect(result).toHaveMessages(["Service is unavailable."]);
  });

  it("converts empty errorCode string to undefined", () => {
    const proto = D2ResultProtoFns.create({
      success: false,
      statusCode: HttpStatusCode.BadRequest,
      errorCode: "",
    });

    const result = d2ResultFromProto(proto);

    expect(result.errorCode).toBeUndefined();
  });

  it("converts empty traceId string to undefined", () => {
    const proto = D2ResultProtoFns.create({
      success: false,
      statusCode: HttpStatusCode.BadRequest,
      traceId: "",
    });

    const result = d2ResultFromProto(proto);

    expect(result.traceId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Input errors
// ---------------------------------------------------------------------------

describe("d2ResultFromProto — input errors", () => {
  it("converts proto input errors to tuple format", () => {
    const proto = D2ResultProtoFns.create({
      success: false,
      statusCode: HttpStatusCode.BadRequest,
      errorCode: ErrorCodes.VALIDATION_FAILED,
      inputErrors: [
        InputErrorProtoFns.create({
          field: "email",
          errors: ["Email is required.", "Email must be valid."],
        }),
        InputErrorProtoFns.create({
          field: "password",
          errors: ["Password is required."],
        }),
      ],
    });

    const result = d2ResultFromProto(proto);

    expect(result).toHaveInputErrors([
      ["email", "Email is required.", "Email must be valid."],
      ["password", "Password is required."],
    ]);
  });

  it("preserves empty input errors array", () => {
    const proto = D2ResultProtoFns.create({
      success: false,
      statusCode: HttpStatusCode.BadRequest,
      inputErrors: [],
    });

    const result = d2ResultFromProto(proto);

    expect(result.inputErrors).toHaveLength(0);
  });
});
