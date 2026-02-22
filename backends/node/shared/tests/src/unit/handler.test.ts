import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BaseHandler,
  HandlerContext,
  OrgType,
  DEFAULT_HANDLER_OPTIONS,
  type IHandlerContext,
  type IRequestContext,
  type HandlerOptions,
} from "@d2/handler";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import { createLogger, type ILogger } from "@d2/logging";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestRequestContext(overrides?: Partial<IRequestContext>): IRequestContext {
  return {
    traceId: "test-trace-id",
    requestId: "test-request-id",
    requestPath: "/test",
    isAuthenticated: true,
    userId: "user-123",
    email: "testuser@example.com",
    username: "testuser",
    agentOrgId: "org-agent-1",
    agentOrgName: "Agent Org",
    agentOrgType: OrgType.Admin,
    targetOrgId: "org-target-1",
    targetOrgName: "Target Org",
    targetOrgType: OrgType.Customer,
    isOrgEmulating: false,
    impersonatedBy: undefined,
    impersonatingEmail: undefined,
    impersonatingUsername: undefined,
    isUserImpersonating: false,
    isAgentStaff: true,
    isAgentAdmin: true,
    isTargetingStaff: false,
    isTargetingAdmin: false,
    ...overrides,
  };
}

function createTestContext(overrides?: Partial<IRequestContext>): IHandlerContext {
  const logger = createLogger({ level: "silent" as never });
  return new HandlerContext(createTestRequestContext(overrides), logger);
}

// A simple concrete handler for testing
class SuccessHandler extends BaseHandler<{ value: string }, { result: string }> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: {
    value: string;
  }): Promise<D2Result<{ result: string } | undefined>> {
    return D2Result.ok({ data: { result: input.value.toUpperCase() } });
  }
}

class FailureHandler extends BaseHandler<{ value: string }, { result: string }> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(_input: {
    value: string;
  }): Promise<D2Result<{ result: string } | undefined>> {
    return D2Result.fail({
      messages: ["Something went wrong"],
    });
  }
}

class ExceptionHandler extends BaseHandler<{ value: string }, { result: string }> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(_input: {
    value: string;
  }): Promise<D2Result<{ result: string } | undefined>> {
    throw new Error("Unhandled test exception");
  }
}

class SlowHandler extends BaseHandler<{ delayMs: number }, void> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: { delayMs: number }): Promise<D2Result<void | undefined>> {
    await new Promise((resolve) => setTimeout(resolve, input.delayMs));
    return D2Result.ok();
  }
}

// ---------------------------------------------------------------------------
// BaseHandler execution
// ---------------------------------------------------------------------------

describe("BaseHandler", () => {
  it("successful execution returns D2Result.ok", async () => {
    const context = createTestContext();
    const handler = new SuccessHandler(context);

    const result = await handler.handleAsync({ value: "hello" });

    expect(result).toBeSuccess();
    expect(result).toHaveData({ result: "HELLO" });
  });

  it("failed execution returns D2Result.fail", async () => {
    const context = createTestContext();
    const handler = new FailureHandler(context);

    const result = await handler.handleAsync({ value: "hello" });

    expect(result).toBeFailure();
    expect(result.messages).toContain("Something went wrong");
  });

  it("exception in executeAsync returns D2Result.unhandledException", async () => {
    const context = createTestContext();
    const handler = new ExceptionHandler(context);

    const result = await handler.handleAsync({ value: "hello" });

    expect(result).toBeFailure();
    expect(result).toHaveStatusCode(HttpStatusCode.InternalServerError);
    expect(result.errorCode).toBe(ErrorCodes.UNHANDLED_EXCEPTION);
  });

  it("preserves traceId in exception result", async () => {
    const context = createTestContext({ traceId: "my-trace" });
    const handler = new ExceptionHandler(context);

    const result = await handler.handleAsync({ value: "hello" });

    expect(result.traceId).toBe("my-trace");
  });
});

// ---------------------------------------------------------------------------
// HandlerOptions
// ---------------------------------------------------------------------------

describe("HandlerOptions", () => {
  it("has correct default values", () => {
    expect(DEFAULT_HANDLER_OPTIONS.suppressTimeWarnings).toBe(false);
    expect(DEFAULT_HANDLER_OPTIONS.logInput).toBe(true);
    expect(DEFAULT_HANDLER_OPTIONS.logOutput).toBe(true);
    expect(DEFAULT_HANDLER_OPTIONS.warningThresholdMs).toBe(100);
    expect(DEFAULT_HANDLER_OPTIONS.criticalThresholdMs).toBe(500);
  });

  it("logInput controls debug logging", async () => {
    const logger = createLogger({ level: "debug" as never });
    const debugSpy = vi.spyOn(logger, "debug");
    const context = new HandlerContext(createTestRequestContext(), logger);
    const handler = new SuccessHandler(context);

    // With logInput: false
    await handler.handleAsync({ value: "test" }, { logInput: false });
    const inputLogCalls = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("received input"),
    );
    expect(inputLogCalls).toHaveLength(0);

    debugSpy.mockClear();

    // With logInput: true (default)
    await handler.handleAsync({ value: "test" }, { logInput: true });
    const inputLogCalls2 = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("received input"),
    );
    expect(inputLogCalls2).toHaveLength(1);
  });

  it("logOutput controls debug logging", async () => {
    const logger = createLogger({ level: "debug" as never });
    const debugSpy = vi.spyOn(logger, "debug");
    const context = new HandlerContext(createTestRequestContext(), logger);
    const handler = new SuccessHandler(context);

    // With logOutput: false
    await handler.handleAsync({ value: "test" }, { logOutput: false });
    const outputLogCalls = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("produced result"),
    );
    expect(outputLogCalls).toHaveLength(0);

    debugSpy.mockClear();

    // With logOutput: true (default)
    await handler.handleAsync({ value: "test" }, { logOutput: true });
    const outputLogCalls2 = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("produced result"),
    );
    expect(outputLogCalls2).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// HandlerContext
// ---------------------------------------------------------------------------

describe("HandlerContext", () => {
  it("bundles request and logger", () => {
    const request = createTestRequestContext();
    const logger = createLogger();
    const context = new HandlerContext(request, logger);

    expect(context.request).toBe(request);
    expect(context.logger).toBe(logger);
  });
});

// ---------------------------------------------------------------------------
// Types parity with .NET
// ---------------------------------------------------------------------------

describe("OrgType", () => {
  it("has all .NET enum values", () => {
    expect(OrgType.Admin).toBe("Admin");
    expect(OrgType.Support).toBe("Support");
    expect(OrgType.Affiliate).toBe("Affiliate");
    expect(OrgType.Customer).toBe("Customer");
    expect(OrgType.CustomerClient).toBe("CustomerClient");
  });

  it("has exactly 5 members", () => {
    const values = Object.values(OrgType);
    expect(values).toHaveLength(5);
  });
});

describe("IRequestContext helper properties", () => {
  it("isAgentStaff is true for Admin org type", () => {
    const request = createTestRequestContext({
      agentOrgType: OrgType.Admin,
      isAgentStaff: true,
      isAgentAdmin: true,
    });
    expect(request.isAgentStaff).toBe(true);
    expect(request.isAgentAdmin).toBe(true);
  });

  it("isAgentStaff is true for Support org type", () => {
    const request = createTestRequestContext({
      agentOrgType: OrgType.Support,
      isAgentStaff: true,
      isAgentAdmin: false,
    });
    expect(request.isAgentStaff).toBe(true);
    expect(request.isAgentAdmin).toBe(false);
  });

  it("isTargetingStaff is false for Customer org type", () => {
    const request = createTestRequestContext({
      targetOrgType: OrgType.Customer,
      isTargetingStaff: false,
      isTargetingAdmin: false,
    });
    expect(request.isTargetingStaff).toBe(false);
    expect(request.isTargetingAdmin).toBe(false);
  });
});
