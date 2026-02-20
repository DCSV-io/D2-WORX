import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { IHandlerContext } from "@d2/handler";
import type {
  MessageRepoHandlers,
  DeliveryRequestRepoHandlers,
  DeliveryAttemptRepoHandlers,
  ChannelPreferenceRepoHandlers,
  TemplateWrapperRepoHandlers,
} from "@d2/comms-app";
import { CreateMessageRecord } from "./c/create-message-record.js";
import { CreateDeliveryRequestRecord } from "./c/create-delivery-request-record.js";
import { CreateDeliveryAttemptRecord } from "./c/create-delivery-attempt-record.js";
import { CreateChannelPreferenceRecord } from "./c/create-channel-preference-record.js";
import { CreateTemplateWrapperRecord } from "./c/create-template-wrapper-record.js";
import { FindMessageById } from "./r/find-message-by-id.js";
import { FindDeliveryRequestById } from "./r/find-delivery-request-by-id.js";
import { FindDeliveryRequestByCorrelationId } from "./r/find-delivery-request-by-correlation-id.js";
import { FindDeliveryAttemptsByRequestId } from "./r/find-delivery-attempts-by-request-id.js";
import { FindChannelPreferenceByUserId } from "./r/find-channel-preference-by-user-id.js";
import { FindChannelPreferenceByContactId } from "./r/find-channel-preference-by-contact-id.js";
import { FindTemplateByNameAndChannel } from "./r/find-template-by-name-and-channel.js";
import { MarkDeliveryRequestProcessed } from "./u/mark-delivery-request-processed.js";
import { UpdateDeliveryAttemptStatus } from "./u/update-delivery-attempt-status.js";
import { UpdateChannelPreferenceRecord } from "./u/update-channel-preference-record.js";
import { UpdateTemplateWrapperRecord } from "./u/update-template-wrapper-record.js";

export function createMessageRepoHandlers(
  db: NodePgDatabase,
  ctx: IHandlerContext,
): MessageRepoHandlers {
  return {
    create: new CreateMessageRecord(db, ctx),
    findById: new FindMessageById(db, ctx),
  };
}

export function createDeliveryRequestRepoHandlers(
  db: NodePgDatabase,
  ctx: IHandlerContext,
): DeliveryRequestRepoHandlers {
  return {
    create: new CreateDeliveryRequestRecord(db, ctx),
    findById: new FindDeliveryRequestById(db, ctx),
    findByCorrelationId: new FindDeliveryRequestByCorrelationId(db, ctx),
    markProcessed: new MarkDeliveryRequestProcessed(db, ctx),
  };
}

export function createDeliveryAttemptRepoHandlers(
  db: NodePgDatabase,
  ctx: IHandlerContext,
): DeliveryAttemptRepoHandlers {
  return {
    create: new CreateDeliveryAttemptRecord(db, ctx),
    findByRequestId: new FindDeliveryAttemptsByRequestId(db, ctx),
    updateStatus: new UpdateDeliveryAttemptStatus(db, ctx),
  };
}

export function createChannelPreferenceRepoHandlers(
  db: NodePgDatabase,
  ctx: IHandlerContext,
): ChannelPreferenceRepoHandlers {
  return {
    create: new CreateChannelPreferenceRecord(db, ctx),
    findByUserId: new FindChannelPreferenceByUserId(db, ctx),
    findByContactId: new FindChannelPreferenceByContactId(db, ctx),
    update: new UpdateChannelPreferenceRecord(db, ctx),
  };
}

export function createTemplateWrapperRepoHandlers(
  db: NodePgDatabase,
  ctx: IHandlerContext,
): TemplateWrapperRepoHandlers {
  return {
    create: new CreateTemplateWrapperRecord(db, ctx),
    findByNameAndChannel: new FindTemplateByNameAndChannel(db, ctx),
    update: new UpdateTemplateWrapperRecord(db, ctx),
  };
}
