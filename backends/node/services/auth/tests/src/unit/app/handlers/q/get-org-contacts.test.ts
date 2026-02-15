import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result, HttpStatusCode } from "@d2/result";
import { GetOrgContacts } from "@d2/auth-app";
import type { IOrgContactRepository } from "@d2/auth-app";
import type { OrgContact } from "@d2/auth-domain";
import type { ContactDTO } from "@d2/protos";
import type { Queries } from "@d2/geo-client";

const VALID_ORG_ID = "01234567-89ab-cdef-0123-456789abcdef";

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

function createMockGetContactsByExtKeys(): Queries.IGetContactsByExtKeysHandler {
  return {
    handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: { data: new Map() } })),
    redaction: { suppressOutput: true },
  } as unknown as Queries.IGetContactsByExtKeysHandler;
}

function createContact(id: string): OrgContact {
  return {
    id,
    organizationId: VALID_ORG_ID,
    label: "Office",
    isPrimary: false,
    createdAt: new Date("2026-02-01"),
    updatedAt: new Date("2026-02-01"),
  };
}

function createContactDTO(id: string): ContactDTO {
  return {
    id,
    createdAt: new Date("2026-02-01"),
    contextKey: "org_contact",
    relatedEntityId: "some-oc-id",
    personalDetails: { firstName: "Test", lastName: "User" },
    contactMethods: { emails: [{ value: `${id}@example.com` }] },
  } as ContactDTO;
}

describe("GetOrgContacts", () => {
  let repo: ReturnType<typeof createMockRepo>;
  let getContactsByExtKeys: Queries.IGetContactsByExtKeysHandler;
  let handler: GetOrgContacts;

  beforeEach(() => {
    repo = createMockRepo();
    getContactsByExtKeys = createMockGetContactsByExtKeys();
    handler = new GetOrgContacts(repo, createTestContext(), getContactsByExtKeys);
  });

  // -----------------------------------------------------------------------
  // Validation tests (Zod schema)
  // -----------------------------------------------------------------------

  it("should return validationFailed when organizationId is not a valid UUID", async () => {
    const result = await handler.handleAsync({ organizationId: "not-a-uuid" });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(result.inputErrors.length).toBeGreaterThanOrEqual(1);
    expect(repo.findByOrgId).not.toHaveBeenCalled();
  });

  it("should return validationFailed when limit is negative", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      limit: -1,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.findByOrgId).not.toHaveBeenCalled();
  });

  it("should return validationFailed when limit exceeds 100", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      limit: 101,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.findByOrgId).not.toHaveBeenCalled();
  });

  it("should return validationFailed when offset is negative", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      offset: -1,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(repo.findByOrgId).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Hydration tests
  // -----------------------------------------------------------------------

  it("should return hydrated contacts with Geo data", async () => {
    const contacts = [createContact("oc-1"), createContact("oc-2"), createContact("oc-3")];
    repo.findByOrgId = vi.fn().mockResolvedValue(contacts);

    // Map keyed by "org_contact:{junction.id}" → ContactDTO[]
    const geoMap = new Map<string, ContactDTO[]>([
      ["org_contact:oc-1", [createContactDTO("geo-1")]],
      ["org_contact:oc-2", [createContactDTO("geo-2")]],
      ["org_contact:oc-3", [createContactDTO("geo-3")]],
    ]);
    getContactsByExtKeys.handleAsync = vi
      .fn()
      .mockResolvedValue(D2Result.ok({ data: { data: geoMap } }));

    const result = await handler.handleAsync({ organizationId: VALID_ORG_ID });

    expect(result.success).toBe(true);
    expect(result.data?.contacts).toHaveLength(3);

    // Verify hydration: each contact has its Geo data attached
    expect(result.data?.contacts[0].geoContact).toBeDefined();
    expect(result.data?.contacts[0].geoContact?.id).toBe("geo-1");
    expect(result.data?.contacts[1].geoContact?.id).toBe("geo-2");
    expect(result.data?.contacts[2].geoContact?.id).toBe("geo-3");

    // Junction metadata is preserved
    expect(result.data?.contacts[0].label).toBe("Office");
  });

  it("should batch fetch all contacts in a single getContactsByExtKeys call", async () => {
    const contacts = [createContact("oc-1"), createContact("oc-2")];
    repo.findByOrgId = vi.fn().mockResolvedValue(contacts);

    await handler.handleAsync({ organizationId: VALID_ORG_ID });

    expect(getContactsByExtKeys.handleAsync).toHaveBeenCalledOnce();
    expect(getContactsByExtKeys.handleAsync).toHaveBeenCalledWith({
      keys: [
        { contextKey: "org_contact", relatedEntityId: "oc-1" },
        { contextKey: "org_contact", relatedEntityId: "oc-2" },
      ],
    });
  });

  it("should return geoContact: null for orphaned junctions (Geo contact missing)", async () => {
    const contacts = [createContact("oc-1"), createContact("oc-2")];
    repo.findByOrgId = vi.fn().mockResolvedValue(contacts);

    // Only oc-1 is in the map — oc-2 is missing (orphaned)
    const geoMap = new Map<string, ContactDTO[]>([
      ["org_contact:oc-1", [createContactDTO("geo-1")]],
    ]);
    getContactsByExtKeys.handleAsync = vi
      .fn()
      .mockResolvedValue(D2Result.ok({ data: { data: geoMap } }));

    const result = await handler.handleAsync({ organizationId: VALID_ORG_ID });

    expect(result.success).toBe(true);
    expect(result.data?.contacts[0].geoContact?.id).toBe("geo-1");
    expect(result.data?.contacts[1].geoContact).toBeNull();
  });

  it("should return all contacts with geoContact: null when Geo call fails", async () => {
    const contacts = [createContact("oc-1")];
    repo.findByOrgId = vi.fn().mockResolvedValue(contacts);
    getContactsByExtKeys.handleAsync = vi.fn().mockResolvedValue(
      D2Result.fail({
        messages: ["Geo service unavailable."],
        statusCode: HttpStatusCode.ServiceUnavailable,
      }),
    );

    const result = await handler.handleAsync({ organizationId: VALID_ORG_ID });

    expect(result.success).toBe(true);
    expect(result.data?.contacts).toHaveLength(1);
    expect(result.data?.contacts[0].geoContact).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Empty results
  // -----------------------------------------------------------------------

  it("should return empty array when no contacts exist", async () => {
    repo.findByOrgId = vi.fn().mockResolvedValue([]);

    const result = await handler.handleAsync({ organizationId: VALID_ORG_ID });

    expect(result.success).toBe(true);
    expect(result.data?.contacts).toHaveLength(0);
    // Should not call getContactsByExtKeys when there are no junctions
    expect(getContactsByExtKeys.handleAsync).not.toHaveBeenCalled();
  });

  it("should pass limit and offset to repository", async () => {
    await handler.handleAsync({ organizationId: VALID_ORG_ID, limit: 10, offset: 20 });

    expect(repo.findByOrgId).toHaveBeenCalledWith(VALID_ORG_ID, 10, 20);
  });
});
