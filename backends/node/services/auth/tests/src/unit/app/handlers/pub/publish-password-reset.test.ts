import { describe, it, expect, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { HttpStatusCode } from "@d2/result";
import { PublishPasswordReset } from "@d2/auth-app";
import type { SendPasswordReset } from "@d2/auth-app";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-test",
    isAuthenticated: true,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

const validInput: SendPasswordReset = {
  userId: "01234567-89ab-cdef-0123-456789abcdef",
  email: "test@example.com",
  name: "Test User",
  resetUrl: "https://example.com/reset-password?token=abc123",
  token: "abc123",
};

describe("PublishPasswordReset", () => {
  let handler: PublishPasswordReset;

  beforeEach(() => {
    handler = new PublishPasswordReset(createTestContext());
  });

  it("should accept valid input and return success", async () => {
    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it("should reject invalid userId", async () => {
    const result = await handler.handleAsync({ ...validInput, userId: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
  });

  it("should reject invalid email", async () => {
    const result = await handler.handleAsync({ ...validInput, email: "not-an-email" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject invalid resetUrl", async () => {
    const result = await handler.handleAsync({ ...validInput, resetUrl: "not-a-url" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject empty token", async () => {
    const result = await handler.handleAsync({ ...validInput, token: "" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject token exceeding 512 characters", async () => {
    const result = await handler.handleAsync({ ...validInput, token: "x".repeat(513) });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should accept valid input at max field lengths", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      name: "x".repeat(128),
      token: "x".repeat(512),
    });

    expect(result.success).toBe(true);
  });
});
