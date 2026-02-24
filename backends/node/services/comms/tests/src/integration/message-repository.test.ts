import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { generateUuidV7 } from "@d2/utilities";
import { createMessage, type Message } from "@d2/comms-domain";
import { createMessageRepoHandlers } from "@d2/comms-infra";
import type { MessageRepoHandlers } from "@d2/comms-app";
import {
  startPostgres,
  stopPostgres,
  getDb,
  cleanAllTables,
} from "./helpers/postgres-test-helpers.js";
import { createTestContext } from "./helpers/test-context.js";

describe("MessageRepository (integration)", () => {
  let repo: MessageRepoHandlers;

  beforeAll(async () => {
    await startPostgres();
    repo = createMessageRepoHandlers(getDb(), createTestContext());
  }, 120_000);

  afterAll(async () => {
    await stopPostgres();
  });

  beforeEach(async () => {
    await cleanAllTables();
  });

  function makeMessage(overrides?: Partial<Message>): Message {
    const base = createMessage({
      content: "Hello **world**",
      plainTextContent: "Hello world",
      senderService: "auth-service",
    });
    return overrides ? { ...base, ...overrides } : base;
  }

  it("should create and retrieve a message by id", async () => {
    const msg = makeMessage();
    const createResult = await repo.create.handleAsync({ message: msg });
    expect(createResult.success).toBe(true);

    const findResult = await repo.findById.handleAsync({ id: msg.id });
    expect(findResult.success).toBe(true);

    const found = findResult.data!.message;
    expect(found.id).toBe(msg.id);
    expect(found.content).toBe("Hello **world**");
    expect(found.plainTextContent).toBe("Hello world");
    expect(found.senderService).toBe("auth-service");
    expect(found.contentFormat).toBe("markdown");
    expect(found.urgency).toBe("normal");
    expect(found.sensitive).toBe(false);
    expect(found.threadId).toBeNull();
    expect(found.parentMessageId).toBeNull();
    expect(found.senderUserId).toBeNull();
    expect(found.senderContactId).toBeNull();
    expect(found.title).toBeNull();
    expect(found.relatedEntityId).toBeNull();
    expect(found.relatedEntityType).toBeNull();
    expect(found.metadata).toBeNull();
    expect(found.editedAt).toBeNull();
    expect(found.deletedAt).toBeNull();
    expect(found.createdAt).toBeInstanceOf(Date);
    expect(found.updatedAt).toBeInstanceOf(Date);
  });

  it("should return notFound for missing id", async () => {
    const result = await repo.findById.handleAsync({ id: generateUuidV7() });
    expect(result.success).toBe(false);
  });

  it("should store nullable fields as null", async () => {
    const msg = makeMessage({
      threadId: null,
      title: null,
      metadata: null,
      senderUserId: null,
      senderContactId: null,
    });
    await repo.create.handleAsync({ message: msg });

    const result = await repo.findById.handleAsync({ id: msg.id });
    const found = result.data!.message;
    expect(found.threadId).toBeNull();
    expect(found.title).toBeNull();
    expect(found.metadata).toBeNull();
    expect(found.senderUserId).toBeNull();
    expect(found.senderContactId).toBeNull();
  });

  it("should store jsonb metadata", async () => {
    const metadata = { source: "test", count: 42, nested: { key: "value" } };
    const msg = makeMessage({ metadata });
    await repo.create.handleAsync({ message: msg });

    const result = await repo.findById.handleAsync({ id: msg.id });
    const found = result.data!.message;
    expect(found.metadata).toEqual(metadata);
  });

  it("should store all content formats", async () => {
    for (const format of ["markdown", "plain", "html"] as const) {
      const msg = makeMessage({
        id: generateUuidV7(),
        contentFormat: format,
      });
      await repo.create.handleAsync({ message: msg });

      const result = await repo.findById.handleAsync({ id: msg.id });
      expect(result.data!.message.contentFormat).toBe(format);
    }
  });

  it("should store all urgency levels", async () => {
    for (const urgency of ["normal", "urgent"] as const) {
      const msg = makeMessage({
        id: generateUuidV7(),
        urgency,
      });
      await repo.create.handleAsync({ message: msg });

      const result = await repo.findById.handleAsync({ id: msg.id });
      expect(result.data!.message.urgency).toBe(urgency);
    }
  });

  it("should store optional fields when provided", async () => {
    const msg = makeMessage({
      threadId: "thread-1",
      parentMessageId: "parent-1",
      senderUserId: "user-1",
      senderContactId: "contact-1",
      title: "Important Notice",
      relatedEntityId: "entity-1",
      relatedEntityType: "invoice",
      sensitive: true,
    });
    await repo.create.handleAsync({ message: msg });

    const result = await repo.findById.handleAsync({ id: msg.id });
    const found = result.data!.message;
    expect(found.threadId).toBe("thread-1");
    expect(found.parentMessageId).toBe("parent-1");
    expect(found.senderUserId).toBe("user-1");
    expect(found.senderContactId).toBe("contact-1");
    expect(found.title).toBe("Important Notice");
    expect(found.relatedEntityId).toBe("entity-1");
    expect(found.relatedEntityType).toBe("invoice");
    expect(found.sensitive).toBe(true);
  });
});
