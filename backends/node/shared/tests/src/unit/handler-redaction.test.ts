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

// Handler with empty inputFields array (should behave as no redaction)
class EmptyInputFieldsHandler extends BaseHandler<{ ip: string; name: string }, { data: string }> {
  override get redaction(): RedactionSpec {
    return { inputFields: [] };
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

// Handler with empty outputFields array (should behave as no redaction)
class EmptyOutputFieldsHandler extends BaseHandler<
  { query: string },
  { secret: string; public: string }
> {
  override get redaction(): RedactionSpec {
    return { outputFields: [] };
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

// Handler that returns undefined data with output field redaction
class NullDataOutputHandler extends BaseHandler<{ query: string }, { secret: string }> {
  override get redaction(): RedactionSpec {
    return { outputFields: ["secret"] };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(_input: {
    query: string;
  }): Promise<D2Result<{ secret: string } | undefined>> {
    return D2Result.notFound({ traceId: this.traceId });
  }
}

// Handler with multiple input fields to redact
class MultiFieldRedactionHandler extends BaseHandler<
  { ip: string; fingerprint: string; name: string },
  { data: string }
> {
  override get redaction(): RedactionSpec {
    return { inputFields: ["ip", "fingerprint"] };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: {
    ip: string;
    fingerprint: string;
    name: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    return D2Result.ok({ data: { data: input.name }, traceId: this.traceId });
  }
}

// Handler with suppressOutput + outputFields (suppression should win)
class SuppressOutputAndFieldsHandler extends BaseHandler<
  { query: string },
  { secret: string; public: string }
> {
  override get redaction(): RedactionSpec {
    return { suppressOutput: true, outputFields: ["secret"] };
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

// Handler that throws an unhandled exception
class ThrowingRedactedHandler extends BaseHandler<{ ip: string }, { data: string }> {
  override get redaction(): RedactionSpec {
    return { suppressInput: true, suppressOutput: true };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(_input: {
    ip: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    throw new Error("Boom!");
  }
}

// Handler that makes manual logger calls inside executeAsync (the "escape hatch" pattern).
// This simulates the FindWhoIs bug: handler has inputFields redaction but logs PII
// manually within its own method body.
class ManualLogSafeHandler extends BaseHandler<
  { ip: string; fingerprint: string },
  { data: string }
> {
  override get redaction(): RedactionSpec {
    return { inputFields: ["ip", "fingerprint"] };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: {
    ip: string;
    fingerprint: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    // Safe: does NOT log raw PII in manual calls
    this.context.logger.warn(`gRPC call failed. TraceId: ${this.traceId}`);
    return D2Result.ok({ data: { data: "ok" }, traceId: this.traceId });
  }
}

// Handler that INCORRECTLY logs PII in manual calls (anti-pattern for testing detection)
class ManualLogLeakyHandler extends BaseHandler<
  { ip: string; fingerprint: string },
  { data: string }
> {
  override get redaction(): RedactionSpec {
    return { inputFields: ["ip", "fingerprint"] };
  }

  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: {
    ip: string;
    fingerprint: string;
  }): Promise<D2Result<{ data: string } | undefined>> {
    // UNSAFE: logs raw PII despite having redaction spec on input
    this.context.logger.warn(`gRPC call failed for IP ${input.ip}. TraceId: ${this.traceId}`);
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

  // -----------------------------------------------------------------------
  // Additional coverage tests
  // -----------------------------------------------------------------------

  it("empty inputFields array logs input as-is (no redaction)", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new EmptyInputFieldsHandler(context);

    await handler.handleAsync({ ip: "1.2.3.4", name: "Alice" });

    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
    expect(inputLog![0]).toContain("1.2.3.4"); // NOT redacted
    expect(inputLog![0]).toContain("Alice");
  });

  it("empty outputFields array logs output as-is (no redaction)", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new EmptyOutputFieldsHandler(context);

    await handler.handleAsync({ query: "test" });

    const outputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("produced result"));
    expect(outputLog).toBeDefined();
    expect(outputLog![0]).toContain("s3cret"); // NOT redacted
    expect(outputLog![0]).toContain("visible");
  });

  it("outputFields with null result.data logs result as-is (no crash)", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new NullDataOutputHandler(context);

    await handler.handleAsync({ query: "test" });

    // Should still log the result even though data is undefined
    const outputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("produced result"));
    expect(outputLog).toBeDefined();
    // Data should not contain [REDACTED] since there's no data to redact
    expect(outputLog![0]).not.toContain("[REDACTED]");
  });

  it("per-call logOutput=false overrides handler with outputFields", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new OutputFieldRedactionHandler(context);

    await handler.handleAsync({ query: "test" }, { logOutput: false });

    // Output should NOT be logged at all
    const outputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("produced result"),
    );
    expect(outputLogs).toHaveLength(0);

    // Input should still be logged
    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
  });

  it("per-call logInput=false overrides handler with inputFields", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new InputFieldRedactionHandler(context);

    await handler.handleAsync({ ip: "1.2.3.4", name: "Alice" }, { logInput: false });

    // Input should NOT be logged at all (per-call option wins)
    const inputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("received input"),
    );
    expect(inputLogs).toHaveLength(0);
  });

  it("multiple input fields are redacted simultaneously", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new MultiFieldRedactionHandler(context);

    await handler.handleAsync({ ip: "1.2.3.4", fingerprint: "abc123", name: "Alice" });

    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
    expect(inputLog![0]).not.toContain("1.2.3.4");
    expect(inputLog![0]).not.toContain("abc123");
    expect(inputLog![0]).toContain("Alice"); // non-redacted field preserved
    // Should have two [REDACTED] occurrences
    const redactedCount = (inputLog![0] as string).split("[REDACTED]").length - 1;
    expect(redactedCount).toBe(2);
  });

  it("suppressOutput + outputFields both set — suppression wins", async () => {
    const { context, debugSpy } = createDebugContext();
    const handler = new SuppressOutputAndFieldsHandler(context);

    await handler.handleAsync({ query: "test" });

    const outputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("produced result"),
    );
    expect(outputLogs).toHaveLength(0); // suppression wins

    // Input should still be logged
    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
  });

  it("handler that throws does not attempt output redaction", async () => {
    const { context, debugSpy } = createDebugContext();
    const errorSpy = vi.spyOn(context.logger, "error");
    const handler = new ThrowingRedactedHandler(context);

    const result = await handler.handleAsync({ ip: "1.2.3.4" });

    // Should get unhandled exception result
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);

    // No input or output debug logs (both suppressed)
    const inputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("received input"),
    );
    const outputLogs = debugSpy.mock.calls.filter((c) =>
      (c[0] as string).includes("produced result"),
    );
    expect(inputLogs).toHaveLength(0);
    expect(outputLogs).toHaveLength(0);

    // Error should still be logged
    expect(errorSpy).toHaveBeenCalled();
    const errorLog = errorSpy.mock.calls.find((c) =>
      (c[0] as string).includes("unhandled exception"),
    );
    expect(errorLog).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Manual logger call PII leak detection tests
  // -----------------------------------------------------------------------

  it("safe manual log call inside executeAsync does not contain raw PII", async () => {
    const { context, debugSpy } = createDebugContext();
    const warnSpy = vi.spyOn(context.logger, "warn");
    const handler = new ManualLogSafeHandler(context);

    const sensitiveIp = "192.168.99.42";
    const sensitiveFingerprint = "secret-fingerprint-abc123";
    await handler.handleAsync({ ip: sensitiveIp, fingerprint: sensitiveFingerprint });

    // Verify BaseHandler's automatic redaction works on input log
    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
    expect(inputLog![0]).not.toContain(sensitiveIp);
    expect(inputLog![0]).not.toContain(sensitiveFingerprint);

    // Verify manual warn() call does NOT contain raw PII
    const allLogCalls = [
      ...debugSpy.mock.calls.map((c) => c[0] as string),
      ...warnSpy.mock.calls.map((c) => c[0] as string),
    ];
    for (const msg of allLogCalls) {
      expect(msg).not.toContain(sensitiveIp);
      expect(msg).not.toContain(sensitiveFingerprint);
    }
  });

  it("leaky manual log call inside executeAsync DOES contain raw PII (demonstrates the anti-pattern)", async () => {
    const { context, debugSpy } = createDebugContext();
    const warnSpy = vi.spyOn(context.logger, "warn");
    const handler = new ManualLogLeakyHandler(context);

    const sensitiveIp = "192.168.99.42";
    await handler.handleAsync({ ip: sensitiveIp, fingerprint: "fp" });

    // BaseHandler's automatic redaction still works on its own debug log
    const inputLog = debugSpy.mock.calls.find((c) => (c[0] as string).includes("received input"));
    expect(inputLog).toBeDefined();
    expect(inputLog![0]).not.toContain(sensitiveIp);

    // But the manual warn() call LEAKS the IP (this is the anti-pattern we fixed)
    const warnCalls = warnSpy.mock.calls.map((c) => c[0] as string);
    const leakyCall = warnCalls.find((msg) => msg.includes(sensitiveIp));
    expect(leakyCall).toBeDefined(); // proves the leak exists in the anti-pattern
  });
});
