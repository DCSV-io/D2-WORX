import { describe, it, expect, beforeEach, vi } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { HttpStatusCode } from "@d2/result";
import { PublishVerificationEmail } from "@d2/auth-app";
import type { SendVerificationEmail } from "@d2/auth-app";

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

function createMockPublisher() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

const validInput: SendVerificationEmail = {
  userId: "01234567-89ab-cdef-0123-456789abcdef",
  email: "test@example.com",
  name: "Test User",
  verificationUrl: "https://example.com/verify-email?token=abc123",
  token: "abc123",
};

describe("PublishVerificationEmail", () => {
  let handler: PublishVerificationEmail;

  beforeEach(() => {
    handler = new PublishVerificationEmail(createTestContext());
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

  it("should reject email exceeding 254 characters", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      email: `${"a".repeat(243)}@example.com`,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject name exceeding 128 characters", async () => {
    const result = await handler.handleAsync({ ...validInput, name: "x".repeat(129) });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject invalid verificationUrl", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      verificationUrl: "not-a-url",
    });

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

  describe("with publisher", () => {
    it("should call publisher.send with correct exchange and serialized proto", async () => {
      const publisher = createMockPublisher();
      const handlerWithPub = new PublishVerificationEmail(createTestContext(), publisher);

      const result = await handlerWithPub.handleAsync(validInput);

      expect(result.success).toBe(true);
      expect(publisher.send).toHaveBeenCalledOnce();

      const [target, body] = publisher.send.mock.calls[0];
      expect(target).toEqual({ exchange: "events.auth", routingKey: "" });
      expect(body.userId).toBe(validInput.userId);
      expect(body.email).toBe(validInput.email);
      expect(body.name).toBe(validInput.name);
      expect(body.verificationUrl).toBe(validInput.verificationUrl);
      expect(body.token).toBe(validInput.token);
    });

    it("should return failure result when publisher throws", async () => {
      const publisher = createMockPublisher();
      publisher.send.mockRejectedValue(new Error("AMQP connection lost"));
      const handlerWithPub = new PublishVerificationEmail(createTestContext(), publisher);

      const result = await handlerWithPub.handleAsync(validInput);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
    });

    it("should not call publisher when input validation fails", async () => {
      const publisher = createMockPublisher();
      const handlerWithPub = new PublishVerificationEmail(createTestContext(), publisher);

      const result = await handlerWithPub.handleAsync({ ...validInput, userId: "bad" });

      expect(result.success).toBe(false);
      expect(publisher.send).not.toHaveBeenCalled();
    });
  });
});
