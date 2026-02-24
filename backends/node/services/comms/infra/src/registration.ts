import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ServiceCollection } from "@d2/di";
import { IHandlerContextKey } from "@d2/handler";
import {
  IPingDbKey,
  ICreateMessageRecordKey,
  IFindMessageByIdKey,
  ICreateDeliveryRequestRecordKey,
  IFindDeliveryRequestByIdKey,
  IFindDeliveryRequestByCorrelationIdKey,
  IMarkDeliveryRequestProcessedKey,
  ICreateDeliveryAttemptRecordKey,
  IFindDeliveryAttemptsByRequestIdKey,
  IUpdateDeliveryAttemptStatusKey,
  ICreateChannelPreferenceRecordKey,
  IFindChannelPreferenceByContactIdKey,
  IUpdateChannelPreferenceRecordKey,
} from "@d2/comms-app";
import { CreateMessageRecord } from "./repository/handlers/c/create-message-record.js";
import { CreateDeliveryRequestRecord } from "./repository/handlers/c/create-delivery-request-record.js";
import { CreateDeliveryAttemptRecord } from "./repository/handlers/c/create-delivery-attempt-record.js";
import { CreateChannelPreferenceRecord } from "./repository/handlers/c/create-channel-preference-record.js";
import { FindMessageById } from "./repository/handlers/r/find-message-by-id.js";
import { FindDeliveryRequestById } from "./repository/handlers/r/find-delivery-request-by-id.js";
import { FindDeliveryRequestByCorrelationId } from "./repository/handlers/r/find-delivery-request-by-correlation-id.js";
import { FindDeliveryAttemptsByRequestId } from "./repository/handlers/r/find-delivery-attempts-by-request-id.js";
import { FindChannelPreferenceByContactId } from "./repository/handlers/r/find-channel-preference-by-contact-id.js";
import { MarkDeliveryRequestProcessed } from "./repository/handlers/u/mark-delivery-request-processed.js";
import { UpdateDeliveryAttemptStatus } from "./repository/handlers/u/update-delivery-attempt-status.js";
import { UpdateChannelPreferenceRecord } from "./repository/handlers/u/update-channel-preference-record.js";
import { PingDb } from "./repository/handlers/q/ping-db.js";

/**
 * Registers comms infrastructure services (repository handlers)
 * with the DI container. Mirrors .NET's `services.AddCommsInfra()` pattern.
 *
 * All repo handlers are transient. Delivery providers (email, SMS) are
 * registered as singleton instances in the composition root since they
 * hold API client connections and need service-level HandlerContext.
 */
export function addCommsInfra(
  services: ServiceCollection,
  db: NodePgDatabase,
): void {
  // Health check handler
  services.addTransient(
    IPingDbKey,
    (sp) => new PingDb(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Message Repository ---
  services.addTransient(
    ICreateMessageRecordKey,
    (sp) => new CreateMessageRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindMessageByIdKey,
    (sp) => new FindMessageById(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Delivery Request Repository ---
  services.addTransient(
    ICreateDeliveryRequestRecordKey,
    (sp) => new CreateDeliveryRequestRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindDeliveryRequestByIdKey,
    (sp) => new FindDeliveryRequestById(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindDeliveryRequestByCorrelationIdKey,
    (sp) => new FindDeliveryRequestByCorrelationId(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IMarkDeliveryRequestProcessedKey,
    (sp) => new MarkDeliveryRequestProcessed(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Delivery Attempt Repository ---
  services.addTransient(
    ICreateDeliveryAttemptRecordKey,
    (sp) => new CreateDeliveryAttemptRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindDeliveryAttemptsByRequestIdKey,
    (sp) => new FindDeliveryAttemptsByRequestId(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IUpdateDeliveryAttemptStatusKey,
    (sp) => new UpdateDeliveryAttemptStatus(db, sp.resolve(IHandlerContextKey)),
  );

  // --- Channel Preference Repository ---
  services.addTransient(
    ICreateChannelPreferenceRecordKey,
    (sp) => new CreateChannelPreferenceRecord(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IFindChannelPreferenceByContactIdKey,
    (sp) => new FindChannelPreferenceByContactId(db, sp.resolve(IHandlerContextKey)),
  );
  services.addTransient(
    IUpdateChannelPreferenceRecordKey,
    (sp) => new UpdateChannelPreferenceRecord(db, sp.resolve(IHandlerContextKey)),
  );

}
