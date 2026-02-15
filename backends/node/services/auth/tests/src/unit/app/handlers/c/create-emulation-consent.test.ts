import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { HttpStatusCode, ErrorCodes } from "@d2/result";
import { CreateEmulationConsent } from "@d2/auth-app";
import type { IEmulationConsentRepository } from "@d2/auth-app";
import type { EmulationConsent } from "@d2/auth-domain";

const VALID_USER_ID = "01234567-89ab-cdef-0123-456789abcdef";
const VALID_ORG_ID = "abcdef01-2345-6789-abcd-ef0123456789";

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

describe("CreateEmulationConsent", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let handler: CreateEmulationConsent;
  let checkOrgExists: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    repo = createMockRepo();
    checkOrgExists = vi.fn().mockResolvedValue(true);
    handler = new CreateEmulationConsent(repo, createTestContext(), checkOrgExists);
  });

  // -----------------------------------------------------------------------
  // Existing business-logic tests
  // -----------------------------------------------------------------------

  it("should create consent when org type is support", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "support",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(true);
    expect(result.data?.consent).toBeDefined();
    expect(result.data?.consent.userId).toBe(VALID_USER_ID);
    expect(result.data?.consent.grantedToOrgId).toBe(VALID_ORG_ID);
    expect(result.data?.consent.revokedAt).toBeNull();
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("should create consent when org type is admin", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "admin",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(true);
    expect(result.data?.consent).toBeDefined();
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("should return Forbidden when org type is customer", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "customer",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Forbidden);
    expect(result.errorCode).toBe(ErrorCodes.FORBIDDEN);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("should return Forbidden when org type is third_party", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "third_party",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Forbidden);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("should return Forbidden when org type is affiliate", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "affiliate",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Forbidden);
    expect(repo.create).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Validation tests (Zod schema)
  // -----------------------------------------------------------------------

  it("should return validationFailed when userId is not a valid UUID", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: "not-a-uuid",
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "support",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(result.inputErrors.length).toBeGreaterThanOrEqual(1);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("should return validationFailed when grantedToOrgId is not a valid UUID", async () => {
    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: "bad-org-id",
      activeOrgType: "support",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("should return validationFailed when expiresAt is in the past", async () => {
    const pastDate = new Date(Date.now() - 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "support",
      expiresAt: pastDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("should return validationFailed when expiresAt exceeds 30 days", async () => {
    const tooFarDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "support",
      expiresAt: tooFarDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.create).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Org existence check
  // -----------------------------------------------------------------------

  it("should return NotFound when target organization does not exist", async () => {
    checkOrgExists.mockResolvedValue(false);

    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "support",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.NotFound);
    expect(result.errorCode).toBe(ErrorCodes.NOT_FOUND);
    expect(checkOrgExists).toHaveBeenCalledWith(VALID_ORG_ID);
    expect(repo.create).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Duplicate prevention
  // -----------------------------------------------------------------------

  it("should return Conflict when an active consent already exists for the same user and org", async () => {
    const existingConsent: EmulationConsent = {
      id: "existing-consent-id",
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      createdAt: new Date("2026-02-01"),
    };
    repo.findActiveByUserIdAndOrg = vi.fn().mockResolvedValue(existingConsent);

    const futureDate = new Date(Date.now() + 86_400_000);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      grantedToOrgId: VALID_ORG_ID,
      activeOrgType: "support",
      expiresAt: futureDate,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Conflict);
    expect(result.errorCode).toBe(ErrorCodes.CONFLICT);
    expect(repo.findActiveByUserIdAndOrg).toHaveBeenCalledWith(VALID_USER_ID, VALID_ORG_ID);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
