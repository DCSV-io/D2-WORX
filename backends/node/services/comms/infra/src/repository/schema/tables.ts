import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// message — standalone transactional messages only (threadId always null in Phase 1)
// ---------------------------------------------------------------------------
export const message = pgTable(
  "message",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    threadId: varchar("thread_id", { length: 36 }),
    parentMessageId: varchar("parent_message_id", { length: 36 }),
    senderUserId: varchar("sender_user_id", { length: 36 }),
    senderContactId: varchar("sender_contact_id", { length: 36 }),
    senderService: varchar("sender_service", { length: 50 }),
    title: varchar("title", { length: 255 }),
    content: text("content").notNull(),
    plainTextContent: text("plain_text_content").notNull(),
    contentFormat: varchar("content_format", { length: 20 }).notNull().default("markdown"),
    sensitive: boolean("sensitive").notNull().default(false),
    urgency: varchar("urgency", { length: 20 }).notNull().default("normal"),
    relatedEntityId: varchar("related_entity_id", { length: 36 }),
    relatedEntityType: varchar("related_entity_type", { length: 100 }),
    metadata: jsonb("metadata"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_message_thread_id").on(t.threadId),
    index("idx_message_sender_user_id").on(t.senderUserId),
  ],
);

// ---------------------------------------------------------------------------
// delivery_request — WHO to deliver to (contactId only)
// ---------------------------------------------------------------------------
export const deliveryRequest = pgTable(
  "delivery_request",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    correlationId: varchar("correlation_id", { length: 36 }).notNull(),
    recipientContactId: varchar("recipient_contact_id", { length: 36 }).notNull(),
    callbackTopic: varchar("callback_topic", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_delivery_request_message_id").on(t.messageId),
    uniqueIndex("idx_delivery_request_correlation_id").on(t.correlationId),
    index("idx_delivery_request_recipient_contact_id").on(t.recipientContactId),
  ],
);

// ---------------------------------------------------------------------------
// delivery_attempt — WHERE we sent (resolved address) + HOW it went
// ---------------------------------------------------------------------------
export const deliveryAttempt = pgTable(
  "delivery_attempt",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requestId: varchar("request_id", { length: 36 }).notNull(),
    channel: varchar("channel", { length: 20 }).notNull(),
    recipientAddress: varchar("recipient_address", { length: 320 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    error: text("error"),
    attemptNumber: integer("attempt_number").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_delivery_attempt_request_id").on(t.requestId),
    index("idx_delivery_attempt_status_retry").on(t.status, t.nextRetryAt),
  ],
);

// ---------------------------------------------------------------------------
// channel_preference — per-contact channel preferences
// ---------------------------------------------------------------------------
export const channelPreference = pgTable(
  "channel_preference",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    contactId: varchar("contact_id", { length: 36 }).notNull(),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    smsEnabled: boolean("sms_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idx_channel_pref_contact_id").on(t.contactId)],
);
