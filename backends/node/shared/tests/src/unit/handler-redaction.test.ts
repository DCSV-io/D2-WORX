import { describe, it, expect, vi } from "vitest";
import {
  BaseHandler,
  HandlerContext,
  OrgType,
  type IHandlerContext,
  type IRequestContext,
  type RedactionSpec,
} from "@d2/handler";
import { D2Result } from "@d2/result";
import { createLogger } from "@d2/logging";

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
    username: "testuser",
    agentOrgId: "org-agent-1",
    agentOrgName: "Agent Org",
    agentOrgType: OrgType.Admin,
    targetOrgId: "org-target-1",
    targetOrgName: "Target Org",
    targetOrgType: OrgType.Customer,
    isAgentStaff: true,
    isAgentAdmin: true,
    isTargetingStaff: false,
    isTargetingAdmin: false,
    ...overrides,
  };
}

function createDebugContext(): { context: IHandlerContext; debugSpy: ReturnType<typeof vi.spyOn> } {
  const logger = createLogger({ level: "debug" as never });
  const debugSpy = vi.spyOn(logger, "debug");
  const context = new HandlerContext(createTestRequestContext(), logger);
  return { context, debugSpy };
}

// Handler with no redaction (default)
class PlainHandler extends BaseHandler<{ ip: string; name: string }, { data: string }> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: {
    ip: string;
    name: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    return D2Result.ok({ data: { data: input.name }, traceId: this.traceId });
  }
}

// Handler with field-level input redaction
class InputFieldRedactionHandler extends BaseHandler<
  { ip: string; name: string },
  { data: string }
> {
  override get redaction(): RedactionSpec {
    return { inputFields: ["ip"] };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: {
    ip: string;
    name: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    return D2Result.ok({ data: { data: input.name }, traceId: this.traceId });
  }
}

// Handler with field-level output redaction
class OutputFieldRedactionHandler extends BaseHandler<
  { query: string },
  { secret: string; public: string }
> {
  override get redaction(): RedactionSpec {
    return { outputFields: ["secret"] };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(_input: {
    query: string;
  }): Promise<D2Result<{ secret: string; public: string } | undefined>> {
    return D2Result.ok({
      data: { secret: "s3cret", public: "visible" },
      traceId: this.traceId,
    });
  }
}

// Handler with suppressInput
class SuppressInputHandler extends BaseHandler<{ ip: string }, { data: string }> {
  override get redaction(): RedactionSpec {
    return { suppressInput: true };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(_input: {
    ip: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    return D2Result.ok({ data: { data: "ok" }, traceId: this.traceId });
  }
}

// Handler with suppressOutput
class SuppressOutputHandler extends BaseHandler<{ query: string }, { data: string }> {
  override get redaction(): RedactionSpec {
    return { suppressOutput: true };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(_input: {
    query: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    return D2Result.ok({ data: { data: "secret-data" }, traceId: this.traceId });
  }
}

// Handler with both suppress and fields (suppress should win)
class SuppressAndFieldsHandler extends BaseHandler<{ ip: string }, { data: string }> {
  override get redaction(): RedactionSpec {
    return { suppressInput: true, inputFields: ["ip"] };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(_input: {
    ip: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    return D2Result.ok({ data: { data: "ok" }, traceId: this.traceId });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BaseHandler redaction", () => {
  it("handler with no redaction logs input and output as-is", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new PlainHandler(context);

    await handler.handleAsync({ ip: "1.2.3.4", name: "Alice" });

    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
    expect(inputLog![0]).toContain("1.2.3.4");
    expect(inputLog![0]).toContain("Alice");

    const outputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("produced result"));
    expect(outputLog).toBeDefined();
    expect(outputLog![0]).toContain("Alice");
  });

  it("inputFields masks specified fields in input log", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new InputFieldRedactionHandler(context);

    await handler.handleAsync({ ip: "1.2.3.4", name: "Alice" });

    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
    expect(inputLog![0]).toContain("[REDACTED]");
    expect(inputLog![0]).not.toContain("1.2.3.4");
    expect(inputLog![0]).toContain("Alice"); // non-redacted field preserved
  });

  it("outputFields masks specified fields in output log", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new OutputFieldRedactionHandler(context);

    await handler.handleAsync({ query: "test" });

    const outputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("produced result"));
    expect(outputLog).toBeDefined();
    expect(outputLog![0]).toContain("[REDACTED]");
    expect(outputLog![0]).not.toContain("s3cret");
    expect(outputLog![0]).toContain("visible"); // non-redacted field preserved
  });

  it("suppressInput prevents input from being logged", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new SuppressInputHandler(context);

    await handler.handleAsync({ ip: "1.2.3.4" });

    const inputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("received input"),
    );
    expect(inputLogs).toHaveLength(0);

    // Output should still be logged
    const outputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("produced result"));
    expect(outputLog).toBeDefined();
  });

  it("suppressOutput prevents output from being logged", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new SuppressOutputHandler(context);

    await handler.handleAsync({ query: "test" });

    const outputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("produced result"),
    );
    expect(outputLogs).toHaveLength(0);

    // Input should still be logged
    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
  });

  it("per-call logInput=false still suppresses even without RedactionSpec", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new PlainHandler(context);

    await handler.handleAsync({ ip: "1.2.3.4", name: "Alice" }, { logInput: false });

    const inputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("received input"),
    );
    expect(inputLogs).toHaveLength(0);
  });

  it("field mask on non-existent fields does not error", async () => {
    const { context, debugSpy } = createDebugContext();

    class NonExistentFieldHandler extends BaseHandler<{ name: string }, { data: string }> {
      override get redaction(): RedactionSpec {
        return { inputFields: ["doesNotExist", "alsoMissing"] };
      }

      constructor(ctx: IHandlerContext) {
        super(ctx);
      }

      protected async executeAsync(input: {
        name: string;
      }): Promise<D2Result<{ data: string } | undefined>> {
        return D2Result.ok({ data: { data: input.name } });
      }
    }

    const handler = new NonExistentFieldHandler(context);
    await handler.handleAsync({ name: "Alice" });

    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
    expect(inputLog![0]).toContain("Alice"); // original value logged unchanged
  });

  it("suppress + fields both set — suppression wins", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new SuppressAndFieldsHandler(context);

    await handler.handleAsync({ ip: "1.2.3.4" });

    const inputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("received input"),
    );
    expect(inputLogs).toHaveLength(0); // suppression wins
  });

  it("redaction getter returns undefined by default", () => {
    const context = new HandlerContext(
      createTestRequestContext(),
      createLogger({ level: "silent" as never }),
    );
    const handler = new PlainHandler(context);
    expect(handler.redaction).toBeUndefined();
  });

  it("redaction getter returns spec when overridden", () => {
    const context = new HandlerContext(
      createTestRequestContext(),
      createLogger({ level: "silent" as never }),
    );
    const handler = new SuppressInputHandler(context);
    expect(handler.redaction).toEqual({ suppressInput: true });
  });
});
