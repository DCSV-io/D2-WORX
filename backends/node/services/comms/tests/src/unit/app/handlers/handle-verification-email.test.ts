import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { HandleVerificationEmail } from "@d2/comms-app";
import { createMockContext } from "../helpers/mock-handlers.js";

describe("HandleVerificationEmail", () => {
  it("should call Deliver with correct parameters", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleVerificationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      userId: "user-123",
      email: "user@example.com",
      name: "Test User",
      verificationUrl: "https://example.com/verify?token=abc",
      token: "abc",
    });

    expect(result.success).toBe(true);
    expect(mockDeliver.handleAsync).toHaveBeenCalledOnce();

    const deliverInput = mockDeliver.handleAsync.mock.calls[0][0];
    expect(deliverInput.senderService).toBe("auth");
    expect(deliverInput.sensitive).toBe(true);
    expect(deliverInput.recipientUserId).toBe("user-123");
    expect(deliverInput.channels).toEqual(["email"]);
    expect(deliverInput.templateName).toBe("email-verification");
    expect(deliverInput.content).toContain("verify");
    expect(deliverInput.correlationId).toBeDefined();
  });

  it("should propagate Deliver failure", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(D2Result.fail({ messages: ["Delivery failed"], statusCode: 502 })),
    };

    const handler = new HandleVerificationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      userId: "user-123",
      email: "user@example.com",
      name: "Test User",
      verificationUrl: "https://example.com/verify?token=abc",
      token: "abc",
    });

    expect(result.success).toBe(false);
  });

  it("should propagate DELIVERY_FAILED error code via bubbleFail", async () => {
    const mockDeliver = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.fail({
          messages: ["Delivery failed for 1 channel(s), retry scheduled."],
          statusCode: 503,
          errorCode: "DELIVERY_FAILED",
        }),
      ),
    };

    const handler = new HandleVerificationEmail(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      userId: "user-123",
      email: "user@example.com",
      name: "Test User",
      verificationUrl: "https://example.com/verify?token=abc",
      token: "abc",
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("DELIVERY_FAILED");
    expect(result.statusCode).toBe(503);
  });

  it("should generate unique correlationId per invocation", async () => {
    const correlationIds: string[] = [];
    const mockDeliver = {
      handleAsync: vi.fn().mockImplementation((input: { correlationId: string }) => {
        correlationIds.push(input.correlationId);
        return D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } });
      }),
    };

    const handler = new HandleVerificationEmail(mockDeliver as any, createMockContext());

    const baseInput = {
      userId: "user-1",
      email: "a@b.com",
      name: "A",
      verificationUrl: "https://example.com/verify",
      token: "t",
    };

    await handler.handleAsync(baseInput);
    await handler.handleAsync(baseInput);

    expect(correlationIds).toHaveLength(2);
    expect(correlationIds[0]).not.toBe(correlationIds[1]);
  });

  it("should escape HTML in content but not in plainTextContent", async () => {
    const mockDeliver = {
      handleAsync: vi
        .fn()
        .mockResolvedValue(
          D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
        ),
    };

    const handler = new HandleVerificationEmail(mockDeliver as any, createMockContext());

    await handler.handleAsync({
      userId: "user-xss",
      email: "xss@example.com",
      name: '<script>alert("xss")</script>',
      verificationUrl: "https://example.com/verify?token=abc",
      token: "abc",
    });

    const deliverInput = mockDeliver.handleAsync.mock.calls[0][0];

    // HTML content should have escaped characters
    expect(deliverInput.content).toContain("&lt;script&gt;");
    expect(deliverInput.content).not.toContain("<script>");

    // Plain text content should NOT be escaped (it's not rendered as HTML)
    expect(deliverInput.plainTextContent).toContain('<script>alert("xss")</script>');
  });
});
