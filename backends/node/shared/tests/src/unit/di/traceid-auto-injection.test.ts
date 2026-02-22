import { describe, it, expect } from "vitest";
import { D2Result, HttpStatusCode } from "@d2/result";
import { BaseHandler, HandlerContext, type IHandlerContext } from "@d2/handler";

/** Test handler that returns results WITHOUT traceId. */
class OkHandler extends BaseHandler<{ value: string }, { result: string }> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: {
    value: string;
  }): Promise<D2Result<{ result: string } | undefined>> {
    return D2Result.ok({ data: { result: input.value } });
  }
}

/** Test handler that returns a failure WITHOUT traceId. */
class FailHandler extends BaseHandler<void, void> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(): Promise<D2Result<void | undefined>> {
    return D2Result.fail({
      messages: ["Something went wrong."],
      statusCode: HttpStatusCode.BadRequest,
    });
  }
}

/** Test handler that returns a result WITH traceId explicitly set. */
class ExplicitTraceIdHandler extends BaseHandler<void, void> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(): Promise<D2Result<void | undefined>> {
    return D2Result.ok({ traceId: "explicit-trace-id" });
  }
}

/** Test handler that throws an exception. */
class ThrowHandler extends BaseHandler<void, void> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(): Promise<D2Result<void | undefined>> {
    throw new Error("boom");
  }
}

function createContext(traceId?: string): IHandlerContext {
  return new HandlerContext(
    {
      traceId,
      isAuthenticated: false,
      isAgentStaff: false,
      isAgentAdmin: false,
      isTargetingStaff: false,
      isTargetingAdmin: false,
      isOrgEmulating: false,
      isUserImpersonating: false,
    },
    { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  );
}

describe("BaseHandler traceId auto-injection", () => {
  it("should inject traceId into successful result when handler omits it", async () => {
    const context = createContext("trace-abc");
    const handler = new OkHandler(context);

    const result = await handler.handleAsync({ value: "test" });

    expect(result.success).toBe(true);
    expect(result.traceId).toBe("trace-abc");
    expect(result.data?.result).toBe("test");
  });

  it("should inject traceId into failure result when handler omits it", async () => {
    const context = createContext("trace-def");
    const handler = new FailHandler(context);

    const result = await handler.handleAsync();

    expect(result.success).toBe(false);
    expect(result.traceId).toBe("trace-def");
    expect(result.messages).toContain("Something went wrong.");
  });

  it("should NOT override traceId if handler explicitly sets it", async () => {
    const context = createContext("ambient-trace");
    const handler = new ExplicitTraceIdHandler(context);

    const result = await handler.handleAsync();

    expect(result.traceId).toBe("explicit-trace-id");
  });

  it("should leave traceId undefined when context has no traceId", async () => {
    const context = createContext(undefined);
    const handler = new OkHandler(context);

    const result = await handler.handleAsync({ value: "no-trace" });

    expect(result.traceId).toBeUndefined();
  });

  it("should inject traceId into unhandled exception result", async () => {
    const context = createContext("trace-exception");
    const handler = new ThrowHandler(context);

    const result = await handler.handleAsync();

    expect(result.success).toBe(false);
    expect(result.traceId).toBe("trace-exception");
    expect(result.statusCode).toBe(HttpStatusCode.InternalServerError);
  });

  it("should preserve all result fields when injecting traceId", async () => {
    const context = createContext("trace-preserve");
    const handler = new FailHandler(context);

    const result = await handler.handleAsync();

    expect(result.traceId).toBe("trace-preserve");
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.messages).toContain("Something went wrong.");
    expect(result.success).toBe(false);
  });
});
