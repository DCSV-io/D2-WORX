import { describe, it, expect, beforeEach, vi } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { HttpStatusCode } from "@d2/result";
import { PublishInvitationEmail } from "@d2/auth-app";
import type { SendInvitationEmail } from "@d2/auth-app";

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

const validInput: SendInvitationEmail = {
  invitationId: "01234567-89ab-cdef-0123-456789abcdef",
  inviteeEmail: "invitee@example.com",
  organizationId: "abcdef01-2345-6789-abcd-ef0123456789",
  organizationName: "Test Org",
  role: "agent",
  inviterName: "Admin User",
  inviterEmail: "admin@example.com",
  invitationUrl: "https://example.com/invite?token=abc123",
};

describe("PublishInvitationEmail", () => {
  let handler: PublishInvitationEmail;

  beforeEach(() => {
    handler = new PublishInvitationEmail(createTestContext());
  });

  it("should accept valid input and return success", async () => {
    const result = await handler.handleAsync(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it("should reject invalid invitationId", async () => {
    const result = await handler.handleAsync({ ...validInput, invitationId: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
  });

  it("should reject invalid inviteeEmail", async () => {
    const result = await handler.handleAsync({ ...validInput, inviteeEmail: "not-an-email" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject invalid organizationId", async () => {
    const result = await handler.handleAsync({ ...validInput, organizationId: "bad" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject organizationName exceeding 128 characters", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      organizationName: "x".repeat(129),
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject role exceeding 32 characters", async () => {
    const result = await handler.handleAsync({ ...validInput, role: "x".repeat(33) });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject invalid inviterEmail", async () => {
    const result = await handler.handleAsync({ ...validInput, inviterEmail: "not-valid" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should reject invalid invitationUrl", async () => {
    const result = await handler.handleAsync({ ...validInput, invitationUrl: "not-a-url" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
  });

  it("should accept valid input at max field lengths", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      organizationName: "x".repeat(128),
      role: "x".repeat(32),
      inviterName: "x".repeat(128),
    });

    expect(result.success).toBe(true);
  });

  it("should accept input with inviteeUserId", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      inviteeUserId: "01234567-89ab-cdef-0123-456789abcdef",
    });

    expect(result.success).toBe(true);
  });

  it("should accept input with inviteeContactId", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      inviteeContactId: "abcdef01-2345-6789-abcd-ef0123456789",
    });

    expect(result.success).toBe(true);
  });

  it("should reject invalid inviteeUserId", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      inviteeUserId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
  });

  it("should reject invalid inviteeContactId", async () => {
    const result = await handler.handleAsync({
      ...validInput,
      inviteeContactId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
  });

  describe("with publisher", () => {
    it("should call publisher.send with correct exchange and serialized proto", async () => {
      const publisher = createMockPublisher();
      const handlerWithPub = new PublishInvitationEmail(createTestContext(), publisher);

      const result = await handlerWithPub.handleAsync(validInput);

      expect(result.success).toBe(true);
      expect(publisher.send).toHaveBeenCalledOnce();

      const [target, body] = publisher.send.mock.calls[0];
      expect(target).toEqual({ exchange: "events.auth", routingKey: "" });
      expect(body.invitationId).toBe(validInput.invitationId);
      expect(body.inviteeEmail).toBe(validInput.inviteeEmail);
      expect(body.organizationId).toBe(validInput.organizationId);
      expect(body.organizationName).toBe(validInput.organizationName);
      expect(body.role).toBe(validInput.role);
      expect(body.inviterName).toBe(validInput.inviterName);
      expect(body.inviterEmail).toBe(validInput.inviterEmail);
      expect(body.invitationUrl).toBe(validInput.invitationUrl);
    });

    it("should include inviteeUserId and inviteeContactId in published message", async () => {
      const publisher = createMockPublisher();
      const handlerWithPub = new PublishInvitationEmail(createTestContext(), publisher);

      const result = await handlerWithPub.handleAsync({
        ...validInput,
        inviteeUserId: "01234567-89ab-cdef-0123-456789abcdef",
        inviteeContactId: "abcdef01-2345-6789-abcd-ef0123456789",
      });

      expect(result.success).toBe(true);
      expect(publisher.send).toHaveBeenCalledOnce();

      const [, body] = publisher.send.mock.calls[0];
      expect(body.inviteeUserId).toBe("01234567-89ab-cdef-0123-456789abcdef");
      expect(body.inviteeContactId).toBe("abcdef01-2345-6789-abcd-ef0123456789");
    });

    it("should return failure result when publisher throws", async () => {
      const publisher = createMockPublisher();
      publisher.send.mockRejectedValue(new Error("AMQP connection lost"));
      const handlerWithPub = new PublishInvitationEmail(createTestContext(), publisher);

      const result = await handlerWithPub.handleAsync(validInput);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
    });

    it("should not call publisher when input validation fails", async () => {
      const publisher = createMockPublisher();
      const handlerWithPub = new PublishInvitationEmail(createTestContext(), publisher);

      const result = await handlerWithPub.handleAsync({
        ...validInput,
        invitationId: "bad",
      });

      expect(result.success).toBe(false);
      expect(publisher.send).not.toHaveBeenCalled();
    });
  });
});
