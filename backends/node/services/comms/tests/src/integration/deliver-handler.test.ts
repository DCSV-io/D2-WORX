import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { D2Result } from "@d2/result";
import { HandlerContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { generateUuidV7 } from "@d2/utilities";
import {
  createDeliveryHandlers,
  createDeliverySubHandlers,
  type DeliveryHandlers,
  type DeliverySubHandlers,
} from "@d2/comms-app";
import {
  createMessageRepoHandlers,
  createDeliveryRequestRepoHandlers,
  createDeliveryAttemptRepoHandlers,
  createChannelPreferenceRepoHandlers,
  createTemplateWrapperRepoHandlers,
  seedDefaultTemplates,
  deliveryRequest as deliveryRequestTable,
  deliveryAttempt as deliveryAttemptTable,
  message as messageTable,
} from "@d2/comms-infra";
import { eq } from "drizzle-orm";
import {
  startPostgres,
  stopPostgres,
  getDb,
  cleanAllTables,
} from "./helpers/postgres-test-helpers.js";
import {
  createStubEmailProvider,
  createMockGeoHandlers,
  type StubEmailProvider,
  type MockGeoHandlers,
} from "./helpers/handler-test-helpers.js";

/**
 * Integration tests for the Deliver handler and sub-handlers.
 *
 * Uses real Postgres (Testcontainers), real repo handlers, a stub email provider,
 * and mock geo-client handlers — validates actual DB records, D2Result outcomes,
 * and the full delivery orchestration pipeline.
 */
describe("Deliver handler (integration)", () => {
  let handlers: DeliveryHandlers;
  let subHandlers: DeliverySubHandlers;
  let stubEmail: StubEmailProvider;
  let mockGeo: MockGeoHandlers;
  let context: HandlerContext;

  beforeAll(async () => {
    await startPostgres();

    const logger = createLogger({ level: "silent" as never });
    context = new HandlerContext(
      {
        traceId: "trace-deliver-integration",
        isAuthenticated: false,
        isAgentStaff: false,
        isAgentAdmin: false,
        isTargetingStaff: false,
        isTargetingAdmin: false,
      },
      logger,
    );

    const db = getDb();
    const repos = {
      message: createMessageRepoHandlers(db, context),
      request: createDeliveryRequestRepoHandlers(db, context),
      attempt: createDeliveryAttemptRepoHandlers(db, context),
      channelPref: createChannelPreferenceRepoHandlers(db, context),
      template: createTemplateWrapperRepoHandlers(db, context),
    };

    stubEmail = createStubEmailProvider(context);
    mockGeo = createMockGeoHandlers();

    handlers = createDeliveryHandlers(
      repos,
      { email: stubEmail },
      mockGeo.getContactsByExtKeys,
      mockGeo.getContactsByIds,
      context,
    );

    subHandlers = createDeliverySubHandlers(handlers.deliver, context);

    // Seed default templates (email-verification, password-reset, invitation, default)
    await seedDefaultTemplates(repos.template, context);
  }, 120_000);

  afterAll(stopPostgres);

  beforeEach(async () => {
    await cleanAllTables();
    stubEmail.clear();
    mockGeo.reset();
  });

  // ---------------------------------------------------------------------------
  // Deliver — Core pipeline
  // ---------------------------------------------------------------------------

  it("should create message, request, and attempt records in the database", async () => {
    mockGeo.setUserEmail("user-1", "user@example.com");

    const result = await handlers.deliver.handleAsync({
      senderService: "auth",
      title: "Test Email",
      content: "<p>Hello</p>",
      plainTextContent: "Hello",
      sensitive: true,
      recipientUserId: "user-1",
      channels: ["email"],
      templateName: "default",
      correlationId: generateUuidV7(),
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const { messageId, requestId, attempts } = result.data!;
    expect(messageId).toBeDefined();
    expect(requestId).toBeDefined();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("sent");

    // Verify actual DB records
    const db = getDb();
    const [msgRow] = await db
      .select()
      .from(messageTable)
      .where(eq(messageTable.id, messageId));
    expect(msgRow).toBeDefined();
    expect(msgRow.title).toBe("Test Email");
    expect(msgRow.senderService).toBe("auth");
    expect(msgRow.sensitive).toBe(true);

    const [reqRow] = await db
      .select()
      .from(deliveryRequestTable)
      .where(eq(deliveryRequestTable.id, requestId));
    expect(reqRow).toBeDefined();
    expect(reqRow.messageId).toBe(messageId);
    expect(reqRow.recipientUserId).toBe("user-1");

    const attemptRows = await db
      .select()
      .from(deliveryAttemptTable)
      .where(eq(deliveryAttemptTable.requestId, requestId));
    expect(attemptRows).toHaveLength(1);
    expect(attemptRows[0].channel).toBe("email");
    expect(attemptRows[0].status).toBe("sent");
    expect(attemptRows[0].recipientAddress).toBe("user@example.com");
  });

  it("should send email via stub provider with correct content", async () => {
    mockGeo.setUserEmail("user-2", "verify@example.com");

    await handlers.deliver.handleAsync({
      senderService: "auth",
      title: "Verify email",
      content: "<p>Click to verify</p>",
      plainTextContent: "Click to verify",
      recipientUserId: "user-2",
      channels: ["email"],
      correlationId: generateUuidV7(),
    });

    expect(stubEmail.sentCount()).toBe(1);
    const email = stubEmail.getLastEmail()!;
    expect(email.to).toBe("verify@example.com");
    expect(email.plainText).toBe("Click to verify");
  });

  it("should enforce idempotency via correlationId — same ID returns existing data", async () => {
    mockGeo.setUserEmail("user-idem", "idem@example.com");

    const correlationId = generateUuidV7();
    const first = await handlers.deliver.handleAsync({
      senderService: "auth",
      title: "Idempotent",
      content: "<p>First call</p>",
      plainTextContent: "First call",
      recipientUserId: "user-idem",
      channels: ["email"],
      correlationId,
    });

    expect(first.success).toBe(true);

    // Second call with same correlationId — should return existing data, not create new records
    const second = await handlers.deliver.handleAsync({
      senderService: "auth",
      title: "Idempotent — should be ignored",
      content: "<p>Should not be created</p>",
      plainTextContent: "Should not be created",
      recipientUserId: "user-idem",
      channels: ["email"],
      correlationId,
    });

    expect(second.success).toBe(true);
    expect(second.data!.messageId).toBe(first.data!.messageId);
    expect(second.data!.requestId).toBe(first.data!.requestId);
    // Only 1 email sent, not 2
    expect(stubEmail.sentCount()).toBe(1);
  });

  it("should return DELIVERY_FAILED when email provider fails", async () => {
    mockGeo.setUserEmail("user-fail", "fail@example.com");

    // Create a failing email provider by overriding executeAsync
    const failingEmail = createStubEmailProvider(context);
    vi.spyOn(failingEmail, "handleAsync").mockResolvedValue(
      D2Result.fail({ messages: ["SMTP timeout"], statusCode: 503 }),
    );

    const db = getDb();
    const repos = {
      message: createMessageRepoHandlers(db, context),
      request: createDeliveryRequestRepoHandlers(db, context),
      attempt: createDeliveryAttemptRepoHandlers(db, context),
      channelPref: createChannelPreferenceRepoHandlers(db, context),
      template: createTemplateWrapperRepoHandlers(db, context),
    };
    const failHandlers = createDeliveryHandlers(
      repos,
      { email: failingEmail },
      mockGeo.getContactsByExtKeys,
      mockGeo.getContactsByIds,
      context,
    );

    const result = await failHandlers.deliver.handleAsync({
      senderService: "auth",
      title: "Will Fail",
      content: "<p>Fail</p>",
      plainTextContent: "Fail",
      recipientUserId: "user-fail",
      channels: ["email"],
      correlationId: generateUuidV7(),
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("DELIVERY_FAILED");
    expect(result.statusCode).toBe(503);

    // Attempt should be persisted with "failed" status
    const attemptRows = await db.select().from(deliveryAttemptTable);
    const failedAttempt = attemptRows.find((a) => a.recipientAddress === "fail@example.com");
    expect(failedAttempt).toBeDefined();
    expect(failedAttempt!.status).toBe("failed");
    expect(failedAttempt!.nextRetryAt).not.toBeNull();
  });

  it("should return not-found when recipient has no deliverable address", async () => {
    // Don't register any geo contact — RecipientResolver returns empty
    const result = await handlers.deliver.handleAsync({
      senderService: "auth",
      title: "No recipient",
      content: "<p>Nowhere to send</p>",
      plainTextContent: "Nowhere to send",
      recipientUserId: "user-nonexistent",
      channels: ["email"],
      correlationId: generateUuidV7(),
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
  });

  it("should mark delivery request as processed on success", async () => {
    mockGeo.setUserEmail("user-proc", "proc@example.com");

    const result = await handlers.deliver.handleAsync({
      senderService: "auth",
      title: "Processed",
      content: "<p>Done</p>",
      plainTextContent: "Done",
      recipientUserId: "user-proc",
      channels: ["email"],
      correlationId: generateUuidV7(),
    });

    expect(result.success).toBe(true);

    const db = getDb();
    const [reqRow] = await db
      .select()
      .from(deliveryRequestTable)
      .where(eq(deliveryRequestTable.id, result.data!.requestId));
    expect(reqRow.processedAt).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Sub-handlers — Full pipeline through real Deliver
  // ---------------------------------------------------------------------------

  it("HandleVerificationEmail should deliver email and persist DB records", async () => {
    mockGeo.setUserEmail("user-verify", "verify-user@example.com");

    const result = await subHandlers.handleVerificationEmail.handleAsync({
      userId: "user-verify",
      email: "verify-user@example.com",
      name: "Test User",
      verificationUrl: "https://app.d2worx.com/verify/abc123",
      token: "abc123",
    });

    expect(result.success).toBe(true);

    // Email should have been sent with correct content
    expect(stubEmail.sentCount()).toBe(1);
    const email = stubEmail.getLastEmail()!;
    expect(email.to).toBe("verify-user@example.com");
    expect(email.html).toContain("Verify Email");
    expect(email.html).toContain("Test User");
    expect(email.plainText).toContain("verify your email");

    // DB should have message + request + attempt
    const db = getDb();
    const messages = await db.select().from(messageTable);
    expect(messages).toHaveLength(1);
    expect(messages[0].senderService).toBe("auth");
    expect(messages[0].sensitive).toBe(true);

    const requests = await db.select().from(deliveryRequestTable);
    expect(requests).toHaveLength(1);
    expect(requests[0].recipientUserId).toBe("user-verify");
    expect(requests[0].processedAt).not.toBeNull();

    const attempts = await db.select().from(deliveryAttemptTable);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].channel).toBe("email");
    expect(attempts[0].status).toBe("sent");
  });

  it("HandlePasswordReset should deliver email and persist DB records", async () => {
    mockGeo.setUserEmail("user-reset", "reset-user@example.com");

    const result = await subHandlers.handlePasswordReset.handleAsync({
      userId: "user-reset",
      email: "reset-user@example.com",
      name: "Reset User",
      resetUrl: "https://app.d2worx.com/reset/xyz789",
      token: "xyz789",
    });

    expect(result.success).toBe(true);

    expect(stubEmail.sentCount()).toBe(1);
    const email = stubEmail.getLastEmail()!;
    expect(email.to).toBe("reset-user@example.com");
    expect(email.html).toContain("Reset Password");
    expect(email.plainText).toContain("password reset");

    const db = getDb();
    const requests = await db.select().from(deliveryRequestTable);
    expect(requests).toHaveLength(1);
    expect(requests[0].recipientUserId).toBe("user-reset");

    const attempts = await db.select().from(deliveryAttemptTable);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("sent");
  });

  it("HandleInvitationEmail should deliver via contactId path", async () => {
    mockGeo.setContactEmail("contact-invite", "invitee@example.com");

    const result = await subHandlers.handleInvitationEmail.handleAsync({
      invitationId: "inv-123",
      inviteeEmail: "invitee@example.com",
      organizationId: "org-1",
      organizationName: "Acme Corp",
      role: "agent",
      inviterName: "Jane Doe",
      inviterEmail: "jane@example.com",
      invitationUrl: "https://app.d2worx.com/accept?id=inv-123",
      inviteeContactId: "contact-invite",
    });

    expect(result.success).toBe(true);

    expect(stubEmail.sentCount()).toBe(1);
    const email = stubEmail.getLastEmail()!;
    expect(email.to).toBe("invitee@example.com");
    expect(email.html).toContain("Acme Corp");
    expect(email.html).toContain("agent");
    expect(email.html).toContain("Jane Doe");
    expect(email.html).toContain("Accept Invitation");

    const db = getDb();
    const requests = await db.select().from(deliveryRequestTable);
    expect(requests).toHaveLength(1);
    expect(requests[0].recipientContactId).toBe("contact-invite");

    const attempts = await db.select().from(deliveryAttemptTable);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("sent");
  });

  // ---------------------------------------------------------------------------
  // Sub-handler failure propagation (through real Deliver)
  // ---------------------------------------------------------------------------

  it("HandleVerificationEmail should propagate DELIVERY_FAILED from Deliver", async () => {
    // Register user but make email provider fail
    mockGeo.setUserEmail("user-vfail", "vfail@example.com");

    const failingEmail = createStubEmailProvider(context);
    vi.spyOn(failingEmail, "handleAsync").mockResolvedValue(
      D2Result.fail({ messages: ["SMTP connection refused"], statusCode: 503 }),
    );

    const db = getDb();
    const repos = {
      message: createMessageRepoHandlers(db, context),
      request: createDeliveryRequestRepoHandlers(db, context),
      attempt: createDeliveryAttemptRepoHandlers(db, context),
      channelPref: createChannelPreferenceRepoHandlers(db, context),
      template: createTemplateWrapperRepoHandlers(db, context),
    };
    const failHandlers = createDeliveryHandlers(
      repos,
      { email: failingEmail },
      mockGeo.getContactsByExtKeys,
      mockGeo.getContactsByIds,
      context,
    );
    const failSubHandlers = createDeliverySubHandlers(failHandlers.deliver, context);

    const result = await failSubHandlers.handleVerificationEmail.handleAsync({
      userId: "user-vfail",
      email: "vfail@example.com",
      name: "Fail User",
      verificationUrl: "https://example.com/verify/fail",
      token: "fail-tok",
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("DELIVERY_FAILED");
    expect(result.statusCode).toBe(503);

    // Attempt should still be persisted with failed status
    const attempts = await db.select().from(deliveryAttemptTable);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("failed");
    expect(attempts[0].error).toContain("SMTP connection refused");
  });

  // ---------------------------------------------------------------------------
  // Channel preference integration
  // ---------------------------------------------------------------------------

  it("should respect channel preferences — email disabled blocks email delivery", async () => {
    const userId = generateUuidV7();
    mockGeo.setUserEmail(userId, "pref@example.com");

    // Disable email for this user (userId must be valid UUID for Zod validation)
    const prefResult = await handlers.setChannelPreference.handleAsync({
      userId,
      emailEnabled: false,
      smsEnabled: true,
    });
    expect(prefResult.success).toBe(true);

    // Non-sensitive, non-urgent message with no explicit channels — system-decided
    // Email is disabled, SMS is enabled but user has no phone → no deliverable channels
    const deliverResult = await handlers.deliver.handleAsync({
      senderService: "system",
      title: "Preference Test",
      content: "<p>test</p>",
      plainTextContent: "test",
      recipientUserId: userId,
      correlationId: generateUuidV7(),
    });

    expect(deliverResult.success).toBe(false);
    expect(deliverResult.statusCode).toBe(404);
    expect(stubEmail.sentCount()).toBe(0);
  });

  it("should read back channel preference via GetChannelPreference", async () => {
    const userId = generateUuidV7();

    await handlers.setChannelPreference.handleAsync({
      userId,
      emailEnabled: true,
      smsEnabled: false,
    });

    const result = await handlers.getChannelPreference.handleAsync({
      userId,
    });

    expect(result.success).toBe(true);
    expect(result.data?.pref).toBeDefined();
    expect(result.data!.pref!.emailEnabled).toBe(true);
    expect(result.data!.pref!.smsEnabled).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Template management integration
  // ---------------------------------------------------------------------------

  it("should upsert and retrieve templates via real DB", async () => {
    const upsertResult = await handlers.upsertTemplate.handleAsync({
      name: "welcome",
      channel: "email",
      subjectTemplate: "Welcome, {{title}}!",
      bodyTemplate: "<h1>{{title}}</h1><p>{{body}}</p>",
    });
    expect(upsertResult.success).toBe(true);

    const getResult = await handlers.getTemplate.handleAsync({
      name: "welcome",
      channel: "email",
    });
    expect(getResult.success).toBe(true);
    expect(getResult.data?.template).toBeDefined();
    expect(getResult.data!.template!.subjectTemplate).toBe("Welcome, {{title}}!");
    expect(getResult.data!.template!.bodyTemplate).toBe("<h1>{{title}}</h1><p>{{body}}</p>");
  });

  it("should use custom template when delivering", async () => {
    mockGeo.setUserEmail("user-tpl", "tpl@example.com");

    // Upsert a custom template
    await handlers.upsertTemplate.handleAsync({
      name: "custom-notification",
      channel: "email",
      subjectTemplate: "[D2] {{title}}",
      bodyTemplate: "<div class='branded'>{{body}}</div>",
    });

    await handlers.deliver.handleAsync({
      senderService: "system",
      title: "System Alert",
      content: "<p>Something happened</p>",
      plainTextContent: "Something happened",
      recipientUserId: "user-tpl",
      channels: ["email"],
      templateName: "custom-notification",
      correlationId: generateUuidV7(),
    });

    expect(stubEmail.sentCount()).toBe(1);
    const email = stubEmail.getLastEmail()!;
    expect(email.subject).toBe("[D2] System Alert");
    expect(email.html).toBe("<div class='branded'><p>Something happened</p></div>");
  });
});
