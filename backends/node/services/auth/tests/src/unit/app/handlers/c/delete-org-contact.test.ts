import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result, HttpStatusCode, ErrorCodes } from "@d2/result";
import { DeleteOrgContact } from "@d2/auth-app";
import type { IOrgContactRepository } from "@d2/auth-app";
import type { OrgContact } from "@d2/auth-domain";
import type { Commands } from "@d2/geo-client";

const VALID_JUNCTION_ID = "01234567-89ab-cdef-0123-456789abcdef";
const VALID_ORG_ID = "abcdef01-2345-6789-abcd-ef0123456789";
const OTHER_ORG_ID = "11111111-1111-1111-1111-111111111111";

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

function createMockRepo(): IOrgContactRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(undefined),
    findByOrgId: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDeleteContactsByExtKeys(): Commands.IDeleteContactsByExtKeysHandler {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { deleted: 1 } })),
  } as unknown as Commands.IDeleteContactsByExtKeysHandler;
}

function createExistingContact(overrides?: Partial<OrgContact>): OrgContact {
  return {
    id: VALID_JUNCTION_ID,
    organizationId: VALID_ORG_ID,
    label: "Billing",
    isPrimary: false,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-01"),
    ...overrides,
  };
}

describe("DeleteOrgContact", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let deleteContactsByExtKeys: Commands.IDeleteContactsByExtKeysHandler;
  let handler: DeleteOrgContact;

  beforeEach(() => {
    repo = createMockRepo();
    deleteContactsByExtKeys = createMockDeleteContactsByExtKeys();
    handler = new DeleteOrgContact(repo, createTestContext(), deleteContactsByExtKeys);
  });

  // -----------------------------------------------------------------------
  // Validation tests (Zod schema)
  // -----------------------------------------------------------------------

  it("should return validationFailed when id is not a valid UUID", async () => {
    const result = await handler.handleAsync({
      id: "not-a-uuid",
      organizationId: VALID_ORG_ID,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(result.inputErrors.length).toBeGreaterThanOrEqual(1);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it("should return validationFailed when organizationId is not a valid UUID", async () => {
    const result = await handler.handleAsync({
      id: VALID_JUNCTION_ID,
      organizationId: "bad-org",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // IDOR check
  // -----------------------------------------------------------------------

  it("should return Forbidden when contact belongs to a different organization", async () => {
    const existing = createExistingContact({ organizationId: OTHER_ORG_ID });
    repo.findById = vi.fn().mockResolvedValue(existing);

    const result = await handler.handleAsync({
      id: VALID_JUNCTION_ID,
      organizationId: VALID_ORG_ID,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.Forbidden);
    expect(result.errorCode).toBe(ErrorCodes.FORBIDDEN);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Junction + Geo deletion
  // -----------------------------------------------------------------------

  it("should delete the junction and call deleteContactsByExtKeys.handleAsync", async () => {
    const existing = createExistingContact();
    repo.findById = vi.fn().mockResolvedValue(existing);

    const result = await handler.handleAsync({
      id: VALID_JUNCTION_ID,
      organizationId: VALID_ORG_ID,
    });

    expect(result.success).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith(VALID_JUNCTION_ID);
    expect(deleteContactsByExtKeys.handleAsync).toHaveBeenCalledWith({
      keys: [{ contextKey: "org_contact", relatedEntityId: VALID_JUNCTION_ID }],
    });
  });

  it("should succeed even when deleteContactsByExtKeys.handleAsync throws (best-effort)", async () => {
    const existing = createExistingContact();
    repo.findById = vi.fn().mockResolvedValue(existing);
    deleteContactsByExtKeys.handleAsync = vi.fn().mockRejectedValue(new Error("Geo is down"));

    const result = await handler.handleAsync({
      id: VALID_JUNCTION_ID,
      organizationId: VALID_ORG_ID,
    });

    expect(result.success).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith(VALID_JUNCTION_ID);
    expect(deleteContactsByExtKeys.handleAsync).toHaveBeenCalledOnce();
  });

  it("should succeed even when deleteContactsByExtKeys.handleAsync returns failure", async () => {
    const existing = createExistingContact();
    repo.findById = vi.fn().mockResolvedValue(existing);
    deleteContactsByExtKeys.handleAsync = vi.fn().mockResolvedValue(
      D2Result.fail({
        messages: ["Geo service error."],
        statusCode: HttpStatusCode.InternalServerError,
      }),
    );

    const result = await handler.handleAsync({
      id: VALID_JUNCTION_ID,
      organizationId: VALID_ORG_ID,
    });

    // The handler swallows Geo failures — junction already deleted
    expect(result.success).toBe(true);
  });

  it("should return NotFound when contact does not exist", async () => {
    repo.findById = vi.fn().mockResolvedValue(undefined);

    const result = await handler.handleAsync({
      id: VALID_JUNCTION_ID,
      organizationId: VALID_ORG_ID,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.NotFound);
    expect(repo.delete).not.toHaveBeenCalled();
    expect(deleteContactsByExtKeys.handleAsync).not.toHaveBeenCalled();
  });
});
