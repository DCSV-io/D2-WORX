import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";

// Use vi.hoisted so the mock reference survives restoreMocks: true
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

// Import after mock setup
const { ResendEmailProvider } = await import("@d2/comms-infra");

function createTestContext(): HandlerContext {
  const request: IRequestContext = {
    traceId: "trace-resend-test",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

describe("ResendEmailProvider", () => {
  let provider: InstanceType<typeof ResendEmailProvider>;

  beforeEach(() => {
    mockSend.mockReset();
    provider = new ResendEmailProvider("re_test_key", "noreply@d2worx.com", createTestContext());
  });

  it("should return providerMessageId on success", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_123abc" }, error: null });

    const result = await provider.handleAsync({
      to: "user@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      plainText: "Hello",
    });

    expect(result.success).toBe(true);
    expect(result.data!.providerMessageId).toBe("msg_123abc");
  });

  it("should return 503 on Resend error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limit exceeded" },
    });

    const result = await provider.handleAsync({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      plainText: "Hi",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
  });

  it("should pass correct fields to Resend SDK", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_456" }, error: null });

    await provider.handleAsync({
      to: "user@example.com",
      subject: "Welcome",
      html: "<h1>Welcome</h1>",
      plainText: "Welcome",
      replyTo: "support@d2worx.com",
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: "noreply@d2worx.com",
      to: "user@example.com",
      subject: "Welcome",
      html: "<h1>Welcome</h1>",
      text: "Welcome",
      replyTo: "support@d2worx.com",
    });
  });

  it("should handle missing replyTo", async () => {
    mockSend.mockResolvedValue({ data: { id: "msg_789" }, error: null });

    await provider.handleAsync({
      to: "user@example.com",
      subject: "No Reply",
      html: "<p>No reply</p>",
      plainText: "No reply",
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: undefined,
      }),
    );
  });
});
