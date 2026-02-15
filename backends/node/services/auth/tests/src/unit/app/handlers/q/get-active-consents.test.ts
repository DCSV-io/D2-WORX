import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { HttpStatusCode } from "@d2/result";
import { GetActiveConsents } from "@d2/auth-app";
import type { IEmulationConsentRepository } from "@d2/auth-app";
import type { EmulationConsent } from "@d2/auth-domain";

const VALID_USER_ID = "01234567-89ab-cdef-0123-456789abcdef";

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

function createMockRepo(): IEmulationConsentRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(undefined),
    findActiveByUserId: vi.fn().mockResolvedValue([]),
    findActiveByUserIdAndOrg: vi.fn().mockResolvedValue(null),
    revoke: vi.fn().mockResolvedValue(undefined),
  };
}

function createConsent(id: string): EmulationConsent {
  return {
    id,
    userId: VALID_USER_ID,
    grantedToOrgId: "abcdef01-2345-6789-abcd-ef0123456789",
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    createdAt: new Date("2026-02-01"),
  };
}

describe("GetActiveConsents", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let handler: GetActiveConsents;

  beforeEach(() => {
    repo = createMockRepo();
    handler = new GetActiveConsents(repo, createTestContext());
  });

  // -----------------------------------------------------------------------
  // Validation tests (Zod schema)
  // -----------------------------------------------------------------------

  it("should return validationFailed when userId is not a valid UUID", async () => {
    const result = await handler.handleAsync({ userId: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(result.inputErrors.length).toBeGreaterThanOrEqual(1);
    expect(repo.findActiveByUserId).not.toHaveBeenCalled();
  });

  it("should return validationFailed when limit is negative", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      limit: -1,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.findActiveByUserId).not.toHaveBeenCalled();
  });

  it("should return validationFailed when limit exceeds 100", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      limit: 101,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.findActiveByUserId).not.toHaveBeenCalled();
  });

  it("should return validationFailed when offset is negative", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      offset: -1,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.findActiveByUserId).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Existing business-logic tests
  // -----------------------------------------------------------------------

  it("should return active consents for a user", async () => {
    const consents = [createConsent("c-1"), createConsent("c-2")];
    repo.findActiveByUserId = vi.fn().mockResolvedValue(consents);

    const result = await handler.handleAsync({ userId: VALID_USER_ID });

    expect(result.success).toBe(true);
    expect(result.data?.consents).toHaveLength(2);
    expect(repo.findActiveByUserId).toHaveBeenCalledWith(VALID_USER_ID, undefined, undefined);
  });

  it("should return empty array when no active consents exist", async () => {
    repo.findActiveByUserId = vi.fn().mockResolvedValue([]);

    const result = await handler.handleAsync({ userId: VALID_USER_ID });

    expect(result.success).toBe(true);
    expect(result.data?.consents).toHaveLength(0);
  });
});
