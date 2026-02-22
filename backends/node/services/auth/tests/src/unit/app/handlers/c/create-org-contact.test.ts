import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result, HttpStatusCode } from "@d2/result";
import { CreateOrgContact } from "@d2/auth-app";
import type { ICreateOrgContactRecordHandler, IDeleteOrgContactRecordHandler } from "@d2/auth-app";
import type { ContactDTO } from "@d2/protos";
import type { Commands } from "@d2/geo-client";

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

function createMockCreateRecord() {
  return { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })) };
}

function createMockDeleteRecord() {
  return { handleAsync: vi.fn().mockResolvedValue(D2Result.ok({ data: {} })) };
}

function createMockCreateContacts(): Commands.ICreateContactsHandler {
  return {
    handleAsync: vi.fn().mockResolvedValue(
      D2Result.ok({
        data: {
          data: [
            {
              id: "geo-contact-001",
              createdAt: new Date("2026-02-10"),
              contextKey: "auth_org_contact",
              relatedEntityId: "placeholder",
            } as ContactDTO,
          ],
        },
      }),
    ),
  } as unknown as Commands.ICreateContactsHandler;
}

const VALID_CONTACT_INPUT = {
  contactMethods: {
    emails: [{ value: "billing@example.com" }],
  },
  personalDetails: {
    firstName: "John",
    lastName: "Doe",
  },
};

describe("CreateOrgContact", () => {
  let createRecord: ReturnType<typeof createMockCreateRecord>;
  let deleteRecord: ReturnType<typeof createMockDeleteRecord>;
  let createContacts: Commands.ICreateContactsHandler;
  let handler: CreateOrgContact;

  beforeEach(() => {
    createRecord = createMockCreateRecord();
    deleteRecord = createMockDeleteRecord();
    createContacts = createMockCreateContacts();
    handler = new CreateOrgContact(
      createRecord as unknown as ICreateOrgContactRecordHandler,
      deleteRecord as unknown as IDeleteOrgContactRecordHandler,
      createTestContext(),
      createContacts,
    );
  });

  // -----------------------------------------------------------------------
  // Validation tests (Zod schema)
  // -----------------------------------------------------------------------

  it("should return validationFailed when organizationId is not a valid UUID", async () => {
    const result = await handler.handleAsync({
      organizationId: "not-a-uuid",
      label: "Billing",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(result.inputErrors.length).toBeGreaterThanOrEqual(1);
    expect(createRecord.handleAsync).not.toHaveBeenCalled();
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when label is empty", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(createRecord.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when label exceeds 100 chars", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "x".repeat(101),
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(createRecord.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when isPrimary is not a boolean", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Billing",
      isPrimary: "yes" as unknown as boolean,
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(createRecord.handleAsync).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Geo contact creation flow
  // -----------------------------------------------------------------------

  it("should create the junction first, then call createContacts.handleAsync", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Billing",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(true);
    expect(createRecord.handleAsync).toHaveBeenCalledOnce();
    expect(createContacts.handleAsync).toHaveBeenCalledOnce();

    // Verify createContacts was called with contacts array containing contextKey
    const call = vi.mocked(createContacts.handleAsync).mock.calls[0][0];
    expect(call.contacts).toHaveLength(1);
    expect(call.contacts[0].contextKey).toBe("auth_org_contact");
    expect(call.contacts[0].relatedEntityId).toBeDefined();
    expect(call.contacts[0].relatedEntityId.length).toBeGreaterThan(0);
  });

  it("should return the Geo contact in geoContact field", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Billing",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(true);
    expect(result.data?.geoContact.id).toBe("geo-contact-001");
  });

  it("should rollback junction and bubble Geo failure when createContacts fails", async () => {
    createContacts.handleAsync = vi.fn().mockResolvedValue(
      D2Result.fail({
        messages: ["Geo service unavailable."],
        statusCode: HttpStatusCode.ServiceUnavailable,
      }),
    );

    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Billing",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.ServiceUnavailable);
    // Junction is created first, then rolled back on Geo failure
    expect(createRecord.handleAsync).toHaveBeenCalledOnce();
    expect(deleteRecord.handleAsync).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // Success flow
  // -----------------------------------------------------------------------

  it("should create an org contact and return success with both contact and geoContact", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Billing",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(true);
    expect(result.data?.contact).toBeDefined();
    expect(result.data?.contact.organizationId).toBe(VALID_ORG_ID);
    expect(result.data?.contact.label).toBe("Billing");
    expect(result.data?.contact.isPrimary).toBe(false);
    expect(result.data?.geoContact).toBeDefined();
    expect(createRecord.handleAsync).toHaveBeenCalledOnce();
  });

  it("should set isPrimary when provided", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Main Office",
      isPrimary: true,
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(true);
    expect(result.data?.contact.isPrimary).toBe(true);
  });

  it("should generate a UUIDv7 id for the junction record", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Shipping",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(true);
    expect(result.data?.contact.id).toBeDefined();
    expect(result.data?.contact.id.length).toBeGreaterThan(0);
  });

  it("should pass the domain contact to the repository (no contactId field)", async () => {
    await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Support",
      contact: VALID_CONTACT_INPUT,
    });

    expect(createRecord.handleAsync).toHaveBeenCalledWith({
      contact: expect.objectContaining({
        organizationId: VALID_ORG_ID,
        label: "Support",
      }),
    });
    // OrgContact no longer has contactId field
    const calledWith = vi.mocked(createRecord.handleAsync).mock.calls[0][0].contact as Record<
      string,
      unknown
    >;
    expect(calledWith).not.toHaveProperty("contactId");
  });

  // -----------------------------------------------------------------------
  // String length bounds (gap #7)
  // -----------------------------------------------------------------------

  it("should return validationFailed when personal name exceeds 255 chars", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Test",
      contact: {
        personalDetails: { firstName: "x".repeat(256) },
      },
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createRecord.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when phone number exceeds 20 chars", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Test",
      contact: {
        contactMethods: { phoneNumbers: [{ value: "1".repeat(21) }] },
      },
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createRecord.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when company name exceeds 255 chars", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Test",
      contact: {
        professionalDetails: { companyName: "x".repeat(256) },
      },
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createRecord.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when country code exceeds 2 chars", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Test",
      contact: {
        location: { countryIso31661Alpha2Code: "USA" },
      },
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createRecord.handleAsync).not.toHaveBeenCalled();
  });

  it("should accept valid input at max field lengths", async () => {
    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "x".repeat(100),
      contact: {
        personalDetails: {
          firstName: "x".repeat(255),
          lastName: "x".repeat(255),
          title: "x".repeat(20),
          generationalSuffix: "x".repeat(10),
        },
        professionalDetails: {
          companyName: "x".repeat(255),
          jobTitle: "x".repeat(255),
        },
        location: {
          city: "x".repeat(255),
          postalCode: "x".repeat(16),
          countryIso31661Alpha2Code: "US",
          subdivisionIso31662Code: "US-CA",
        },
        contactMethods: {
          phoneNumbers: [{ value: "1".repeat(20) }],
        },
      },
    });

    expect(result.success).toBe(true);
    expect(createRecord.handleAsync).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // Repo + rollback failure paths
  // -----------------------------------------------------------------------

  it("should bubble failure when repo createRecord returns error (Geo not called)", async () => {
    createRecord.handleAsync = vi.fn().mockResolvedValue(
      D2Result.fail({
        messages: ["connection lost"],
        statusCode: HttpStatusCode.InternalServerError,
      }),
    );

    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Billing",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.InternalServerError);
    expect(createRecord.handleAsync).toHaveBeenCalledOnce();
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  it("should rollback junction when Geo returns success with empty data array", async () => {
    createContacts.handleAsync = vi.fn().mockResolvedValue(D2Result.ok({ data: { data: [] } }));

    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Billing",
      contact: VALID_CONTACT_INPUT,
    });

    expect(result.success).toBe(false);
    // Junction was created then rolled back
    expect(createRecord.handleAsync).toHaveBeenCalledOnce();
    expect(deleteRecord.handleAsync).toHaveBeenCalledOnce();
  });

  it("should still return Geo failure even when rollback delete throws", async () => {
    createContacts.handleAsync = vi.fn().mockResolvedValue(
      D2Result.fail({
        messages: ["Geo service unavailable."],
        statusCode: HttpStatusCode.ServiceUnavailable,
      }),
    );
    deleteRecord.handleAsync = vi.fn().mockRejectedValue(new Error("DB down"));

    const result = await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "Billing",
      contact: VALID_CONTACT_INPUT,
    });

    // Still returns the Geo failure, rollback error is swallowed
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.ServiceUnavailable);
    expect(createRecord.handleAsync).toHaveBeenCalledOnce();
    expect(deleteRecord.handleAsync).toHaveBeenCalledOnce();
  });

  it("should forward contact details to createContacts handler", async () => {
    await handler.handleAsync({
      organizationId: VALID_ORG_ID,
      label: "HQ",
      contact: {
        contactMethods: {
          emails: [{ value: "hq@example.com", labels: ["primary"] }],
          phoneNumbers: [{ value: "+1234567890" }],
        },
        personalDetails: {
          firstName: "Jane",
          lastName: "Smith",
        },
      },
    });

    const call = vi.mocked(createContacts.handleAsync).mock.calls[0][0];
    expect(call.contacts[0].contactMethods?.emails?.[0].value).toBe("hq@example.com");
    expect(call.contacts[0].contactMethods?.phoneNumbers?.[0].value).toBe("+1234567890");
    expect(call.contacts[0].personalDetails?.firstName).toBe("Jane");
  });
});
