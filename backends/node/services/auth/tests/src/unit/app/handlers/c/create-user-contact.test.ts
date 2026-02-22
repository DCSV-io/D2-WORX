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
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when email exceeds 320 chars", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "a".repeat(321),
      name: "Test User",
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(HttpStatusCode.BadRequest);
    expect(result.inputErrors).toBeDefined();
    expect(createContacts.handleAsync).not.toHaveBeenCalled();
  });

  it("should return validationFailed when name exceeds 200 chars", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "x".repeat(201),
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
    });

    expect(result.success).toBe(true);
    expect(createContacts.handleAsync).toHaveBeenCalledOnce();

    const call = vi.mocked(createContacts.handleAsync).mock.calls[0][0];
    expect(call.contacts).toHaveLength(1);
    expect(call.contacts[0].contextKey).toBe("auth_user");
    expect(call.contacts[0].relatedEntityId).toBe(VALID_USER_ID);
    expect(call.contacts[0].contactMethods?.emails).toHaveLength(1);
    expect(call.contacts[0].contactMethods?.emails[0].value).toBe("test@example.com");
    expect(call.contacts[0].personalDetails?.firstName).toBe("Test User");
  });

  it("should return the created Geo contact in output", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Test User",
    });

    expect(result.success).toBe(true);
    expect(result.data?.contact.id).toBe("geo-contact-001");
  });

  it("should accept empty name", async () => {
    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "",
    });

    expect(result.success).toBe(true);
    const call = vi.mocked(createContacts.handleAsync).mock.calls[0][0];
    expect(call.contacts[0].personalDetails?.firstName).toBe("");
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
    });

    expect(result.success).toBe(false);
  });

  it("should bubble failure when createContacts returns success with no data", async () => {
    createContacts.handleAsync = vi.fn().mockResolvedValue(D2Result.ok({}));

    const result = await handler.handleAsync({
      userId: VALID_USER_ID,
      email: "test@example.com",
      name: "Test User",
    });

    expect(result.success).toBe(false);
  });
});
