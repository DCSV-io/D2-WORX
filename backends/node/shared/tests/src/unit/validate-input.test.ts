import { describe, it, expect } from "vitest";
import { BaseHandler, HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { D2Result, ErrorCodes } from "@d2/result";
import { createLogger } from "@d2/logging";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestContext(): IHandlerContext {
  const request: IRequestContext = {
    traceId: "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

interface TestInput {
  name: string;
  age: number;
}

const testSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.number().int().min(0, "Age must be non-negative").max(150, "Age must be realistic"),
}) as z.ZodType<TestInput>;

class ValidatingHandler extends BaseHandler<TestInput, string> {
  constructor(context: IHandlerContext) {
    super(context);
  }

  protected async executeAsync(input: TestInput): Promise<D2Result<string | undefined>> {
    const validation = this.validateInput(testSchema, input);
    if (validation.failed) {
      return D2Result.bubbleFail(validation);
    }
    return D2Result.ok({ data: `Hello, ${input.name}!`, traceId: this.traceId });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BaseHandler.validateInput", () => {
  it("should return ok for valid input", async () => {
    const handler = new ValidatingHandler(createTestContext());
    const result = await handler.handleAsync({ name: "Alice", age: 30 });

    expect(result).toBeSuccess();
    expect(result.data).toBe("Hello, Alice!");
  });

  it("should return validationFailed for invalid input", async () => {
    const handler = new ValidatingHandler(createTestContext());
    const result = await handler.handleAsync({ name: "", age: -1 });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(result.inputErrors.length).toBeGreaterThanOrEqual(2);
  });

  it("should include field paths in input errors", async () => {
    const handler = new ValidatingHandler(createTestContext());
    const result = await handler.handleAsync({ name: "", age: 30 });

    expect(result).toBeFailure();
    expect(result.errorCode).toBe(ErrorCodes.VALIDATION_FAILED);
    // Should have an error for "name"
    const nameError = result.inputErrors.find((e) => e[0] === "name");
    expect(nameError).toBeDefined();
    expect(nameError![1]).toContain("required");
  });

  it("should include traceId in validation result", async () => {
    const handler = new ValidatingHandler(createTestContext());
    const result = await handler.handleAsync({ name: "", age: 30 });

    expect(result.traceId).toBe("test-trace-id");
  });
});
