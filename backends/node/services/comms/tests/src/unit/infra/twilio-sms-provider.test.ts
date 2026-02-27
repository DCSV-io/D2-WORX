import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";

// Use vi.hoisted so the mock reference survives restoreMocks: true
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("twilio", () => ({
  default: () => ({
    messages: { create: mockCreate },
  }),
}));

// Import after mock setup
const { TwilioSmsProvider } = await import("@d2/comms-infra");

function createTestContext(): HandlerContext {
  const request: IRequestContext = {
    traceId: "trace-twilio-test",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

describe("TwilioSmsProvider", () => {
  let provider: InstanceType<typeof TwilioSmsProvider>;

  beforeEach(() => {
    mockCreate.mockReset();
    provider = new TwilioSmsProvider(
      "AC_test_sid",
      "test_auth_token",
      "+15017122661",
      createTestContext(),
    );
  });

  it("should return providerMessageId on success", async () => {
    mockCreate.mockResolvedValue({ sid: "SM_abc123def456" });

    const result = await provider.handleAsync({
      to: "+15558675310",
      body: "Hello from D2-WORX",
    });

    expect(result.success).toBe(true);
    expect(result.data!.providerMessageId).toBe("SM_abc123def456");
  });

  it("should return 503 on Twilio error", async () => {
    mockCreate.mockRejectedValue(new Error("Authentication error"));

    const result = await provider.handleAsync({
      to: "+15558675310",
      body: "Hello",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.messages).toContain("Authentication error");
  });

  it("should pass correct fields to Twilio SDK", async () => {
    mockCreate.mockResolvedValue({ sid: "SM_789" });

    await provider.handleAsync({
      to: "+15558675310",
      body: "Verification code: 123456",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      from: "+15017122661",
      to: "+15558675310",
      body: "Verification code: 123456",
    });
  });

  it("should handle non-Error thrown values", async () => {
    mockCreate.mockRejectedValue("unexpected string error");

    const result = await provider.handleAsync({
      to: "+15558675310",
      body: "Test",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.messages).toContain("Unknown Twilio error");
  });
});
