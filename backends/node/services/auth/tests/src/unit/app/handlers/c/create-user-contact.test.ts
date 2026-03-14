import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { D2Result, HttpStatusCode } from "@d2/result";
import { CreateUserContact } from "@d2/auth-app";
import type { ContactDTO } from "@d2/protos";
import type { Commands } from "@d2/geo-client";

const VALID_USER_ID = "01234567-89ab-cdef-0123-456789abcdef";

function createTestContext() {
  const request: IRequestContext = {
    traceId: "trace-test",
    isAuthenticated: true,
    isTrustedService: false,
    isOrgEmulating: false,
    isUserImpersonating: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
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
              contextKey: "auth_user",
              relatedEntityId: VALID_USER_ID,
            } as ContactDTO,
          ],
        },
      }),
    ),
  } as unknown as Commands.ICreateContactsHandler;
}

describe("CreateUserContact", () => {
  let createContacts: Commands.ICreateContactsHandler;
  let handler: CreateUserContact;

  beforeEach(() => {
    createContacts = createMockCreateContacts();
    handler = new CreateUserContact(createContacts, createTestContext());
  });

  // -----------------------------------------------------------------------
  // Validation tests (Zod schema)
  // -----------------------------------------------------------------------

  it("should return validationFailed when userId is not a valid UUID", async () => {
    const result = await handler.handleAsync({
      userId: "not-a-uuid",
      email: "test@example.com",
      name: "Test User",
      locale: "en-US",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(Array.isArray(result.inputErrors)).toBe(true);
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when email is empty", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "",
      name: "Test User",
      locale: "en-US",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when email exceeds 254 chars", async () => {
    const longEmail = "a".repeat(246) + "@test.com"; // 255 chars — valid format but over max(254)
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: longEmail,
      name: "Test User",
      locale: "en-US",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when name exceeds 511 chars", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "x".repeat(512),
      locale: "en-US",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Success flow
  // -----------------------------------------------------------------------

  it("should call createContacts.handleAsync with correct ContactToCreateDTO", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Test User",
      locale: "en-US",
    });

    expect(result.success).toBe(true);
    expect(createContacts.handleAsync).toHaveBeenCalledOnce();

    const call = vi.mocked(createContacts.handleAsync).mock.calls[0][0];
    expect(call.contacts).toHaveLength(1);
    expect(call.contacts[0].contextKey).toBe("auth_user");
    expect(call.contacts[0].relatedEntityId).toBe(VALID_USER_ID);
    expect(call.contacts[0].contactMethods?.emails).toHaveLength(1);
    expect(call.contacts[0].contactMethods?.emails[0].value).toBe("test@example.com");
    expect(call.contacts[0].personalDetails?.firstName).toBe("Test");
    expect(call.contacts[0].personalDetails?.lastName).toBe("User");
    expect(call.contacts[0].ietfBcp47Tag).toBe("en-US");
  });

  it("should handle single-word name (no space) — all goes to firstName", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Madonna",
      locale: "en-US",
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(createContacts.handleAsync).mock.calls[0][0];
    expect(call.contacts[0].personalDetails?.firstName).toBe("Madonna");
    expect(call.contacts[0].personalDetails?.lastName).toBe("");
  });

  it("should split multi-word name on first space only", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Mary Jane Watson",
      locale: "en-US",
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(createContacts.handleAsync).mock.calls[0][0];
    expect(call.contacts[0].personalDetails?.firstName).toBe("Mary");
    expect(call.contacts[0].personalDetails?.lastName).toBe("Jane Watson");
  });

  it("should cap each name part at 255 chars (Geo DB limit)", async () => {
    // 255 + " " + 255 = 511 chars — exactly at schema max
    const longFirst = "A".repeat(255);
    const longLast = "B".repeat(255);
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: `${longFirst} ${longLast}`,
      locale: "en-US",
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(createContacts.handleAsync).mock.calls[0][0];
    expect(call.contacts[0].personalDetails?.firstName).toHaveLength(255);
    expect(call.contacts[0].personalDetails?.lastName).toHaveLength(255);
  });

  it("should return the created Geo contact in output", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Test User",
      locale: "en-US",
    });

    expect(result.success).toBe(true);
    expect(result.data?.contact.id).toBe("geo-contact-001");
  });

  it("should return validationFailed when name is empty", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "",
      locale: "en-US",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Failure paths
  // -----------------------------------------------------------------------

  it("should bubble failure when createContacts returns error", async () => {
    createContacts.handleAsync = vi.fn().mockResolvedValue(
      D2Result.fail({
        messages: ["Geo service unavailable."],
        statusCode: HttpStatusCode.ServiceUnavailable,
      }),
    );

    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Test User",
      locale: "en-US",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.ServiceUnavailable);
  });

  it("should bubble failure when createContacts returns success with empty data array", async () => {
    createContacts.handleAsync = vi.fn().mockResolvedValue(D2Result.ok({ data: { data: [] } }));

    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Test User",
      locale: "en-US",
    });

    expect(result.success).toBe(false);
  });

  it("should bubble failure when createContacts returns success with no data", async () => {
    createContacts.handleAsync = vi.fn().mockResolvedValue(D2Result.ok({}));

    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Test User",
      locale: "en-US",
    });

    expect(result.success).toBe(false);
  });
});
