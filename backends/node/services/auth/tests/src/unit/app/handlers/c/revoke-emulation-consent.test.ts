import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { HttpStatusCode, ErrorCodes } from "@d2/result";
import { RevokeEmulationConsent } from "@d2/auth-app";
import type { IEmulationConsentRepository } from "@d2/auth-app";
import type { EmulationConsent } from "@d2/auth-domain";

const VALID_CONSENT_ID = "01234567-89ab-cdef-0123-456789abcdef";
const VALID_USER_ID = "abcdef01-2345-6789-abcd-ef0123456789";

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

function createActiveConsent(overrides?: Partial<EmulationConsent>): EmulationConsent {
  return {
    id: VALID_CONSENT_ID,
    userId: VALID_USER_ID,
    grantedToOrgId: "fedcba98-7654-3210-fedc-ba9876543210",
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    createdAt: new Date("2026-02-01"),
    ...overrides,
  };
}

describe("RevokeEmulationConsent", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let handler: RevokeEmulationConsent;

  beforeEach(() => {
    repo = createMockRepo();
    handler = new RevokeEmulationConsent(repo, createTestContext());
  });

  // -----------------------------------------------------------------------
  // Validation tests (Zod schema)
  // -----------------------------------------------------------------------

  it("should return validationFailed when consentId is not a valid UUID", async () => {
    const result = await handler.handleAsync({
      consentId: "not-a-uuid",
      userId: VALID_USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(result.inputErrors.length).toBeGreaterThanOrEqual(1);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it("should return validationFailed when userId is not a valid UUID", async () => {
    const result = await handler.handleAsync({
      consentId: VALID_CONSENT_ID,
      userId: "invalid-user",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Existing business-logic tests
  // -----------------------------------------------------------------------

  it("should revoke an active consent owned by the user", async () => {
    const consent = createActiveConsent();
    repo.findById = vi.fn().mockResolvedValue(consent);

    const result = await handler.handleAsync({
      consentId: VALID_CONSENT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.success).toBe(true);
    expect(result.data?.consent).toBeDefined();
    expect(result.data?.consent.revokedAt).toBeInstanceOf(Date);
    expect(repo.revoke).toHaveBeenCalledWith(VALID_CONSENT_ID);
  });

  it("should return NotFound when consent does not exist", async () => {
    repo.findById = vi.fn().mockResolvedValue(undefined);

    const result = await handler.handleAsync({
      consentId: VALID_CONSENT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.NotFound);
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it("should return Forbidden when consent belongs to a different user", async () => {
    const consent = createActiveConsent({
      userId: "11111111-1111-1111-1111-111111111111",
    });
    repo.findById = vi.fn().mockResolvedValue(consent);

    const result = await handler.handleAsync({
      consentId: VALID_CONSENT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Forbidden);
    expect(result.errorCode).toBe(ErrorCodes.FORBIDDEN);
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it("should return Conflict when consent is already revoked", async () => {
    const consent = createActiveConsent({
      userId: VALID_USER_ID,
      revokedAt: new Date("2026-02-05"),
    });
    repo.findById = vi.fn().mockResolvedValue(consent);

    const result = await handler.handleAsync({
      consentId: VALID_CONSENT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Conflict);
    expect(result.errorCode).toBe(ErrorCodes.CONFLICT);
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it("should return Conflict when consent is expired", async () => {
    const consent = createActiveConsent({
      userId: VALID_USER_ID,
      expiresAt: new Date(Date.now() - 86_400_000),
    });
    repo.findById = vi.fn().mockResolvedValue(consent);

    const result = await handler.handleAsync({
      consentId: VALID_CONSENT_ID,
      userId: VALID_USER_ID,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Conflict);
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it("should check ownership before checking active status", async () => {
    // Consent belongs to different user AND is already revoked
    const consent = createActiveConsent({
      userId: "11111111-1111-1111-1111-111111111111",
      revokedAt: new Date("2026-02-05"),
    });
    repo.findById = vi.fn().mockResolvedValue(consent);

    const result = await handler.handleAsync({
      consentId: VALID_CONSENT_ID,
      userId: VALID_USER_ID,
    });

    // Should return Forbidden (ownership check), NOT Conflict (active check)
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Forbidden);
  });
});
