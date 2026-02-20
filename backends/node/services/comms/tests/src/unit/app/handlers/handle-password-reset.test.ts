import { describe, it, expect, vi } from "vitest";
import { D2Result } from "@d2/result";
import { HandlePasswordReset } from "@d2/comms-app";
import { createMockContext } from "../helpers/mock-handlers.js";

describe("HandlePasswordReset", () => {
  it("should call Deliver with correct parameters", async () => {
    const mockDeliver = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.ok({ data: { messageId: "m1", requestId: "r1", attempts: [] } }),
      ),
    };

    const handler = new HandlePasswordReset(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      userId: "user-123",
      email: "user@example.com",
      name: "Test User",
      resetUrl: "https://example.com/reset?token=xyz",
      token: "xyz",
    });

    expect(result.success).toBe(true);
    expect(mockDeliver.handleAsync).toHaveBeenCalledOnce();

    const deliverInput = mockDeliver.handleAsync.mock.calls[0][0];
    expect(deliverInput.senderService).toBe("auth");
    expect(deliverInput.sensitive).toBe(true);
    expect(deliverInput.recipientUserId).toBe("user-123");
    expect(deliverInput.channels).toEqual(["email"]);
    expect(deliverInput.templateName).toBe("password-reset");
    expect(deliverInput.content).toContain("reset");
    expect(deliverInput.correlationId).toBeDefined();
  });

  it("should propagate Deliver failure", async () => {
    const mockDeliver = {
      handleAsync: vi.fn().mockResolvedValue(
        D2Result.fail({ messages: ["Delivery failed"], statusCode: 502 }),
      ),
    };

    const handler = new HandlePasswordReset(mockDeliver as any, createMockContext());

    const result = await handler.handleAsync({
      userId: "user-123",
      email: "user@example.com",
      name: "Test User",
      resetUrl: "https://example.com/reset?token=xyz",
      token: "xyz",
    });

    expect(result.success).toBe(false);
  });
});
