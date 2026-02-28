import { createServiceKey } from "@d2/di";

// Import interface types for infra-level keys
import type { IPingDbHandler } from "./interfaces/repository/handlers/index.js";
import type { CheckHealth } from "./implementations/cqrs/handlers/q/check-health.js";
import type {
  ICreateMessageRecordHandler,
  IFindMessageByIdHandler,
  ICreateDeliveryRequestRecordHandler,
  IFindDeliveryRequestByIdHandler,
  IFindDeliveryRequestByCorrelationIdHandler,
  IMarkDeliveryRequestProcessedHandler,
  ICreateDeliveryAttemptRecordHandler,
  IFindDeliveryAttemptsByRequestIdHandler,
  IUpdateDeliveryAttemptStatusHandler,
  ICreateChannelPreferenceRecordHandler,
  IFindChannelPreferenceByContactIdHandler,
  IUpdateChannelPreferenceRecordHandler,
} from "./interfaces/repository/handlers/index.js";
import type { IEmailProvider } from "./interfaces/providers/email/index.js";
import type { ISmsProvider } from "./interfaces/providers/sms/index.js";
import type {
  IPurgeDeletedMessagesHandler,
  IPurgeDeliveryHistoryHandler,
} from "./interfaces/repository/handlers/index.js";

// Import app-layer handler types
import type { Deliver } from "./implementations/cqrs/handlers/x/deliver.js";
import type { RecipientResolver } from "./implementations/cqrs/handlers/x/resolve-recipient.js";
import type { SetChannelPreference } from "./implementations/cqrs/handlers/c/set-channel-preference.js";
import type { GetChannelPreference } from "./implementations/cqrs/handlers/q/get-channel-preference.js";
import type { RunDeletedMessagePurge } from "./implementations/cqrs/handlers/c/run-deleted-message-purge.js";
import type { RunDeliveryHistoryPurge } from "./implementations/cqrs/handlers/c/run-delivery-history-purge.js";

// =============================================================================
// Infrastructure-layer keys (interfaces defined here, implemented in comms-infra)
// =============================================================================

// --- Message Repository ---
export const ICreateMessageRecordKey = createServiceKey<ICreateMessageRecordHandler>(
  "Comms.Repo.CreateMessageRecord",
);
export const IFindMessageByIdKey = createServiceKey<IFindMessageByIdHandler>(
  "Comms.Repo.FindMessageById",
);

// --- Delivery Request Repository ---
export const ICreateDeliveryRequestRecordKey =
  createServiceKey<ICreateDeliveryRequestRecordHandler>("Comms.Repo.CreateDeliveryRequestRecord");
export const IFindDeliveryRequestByIdKey = createServiceKey<IFindDeliveryRequestByIdHandler>(
  "Comms.Repo.FindDeliveryRequestById",
);
export const IFindDeliveryRequestByCorrelationIdKey =
  createServiceKey<IFindDeliveryRequestByCorrelationIdHandler>(
    "Comms.Repo.FindDeliveryRequestByCorrelationId",
  );
export const IMarkDeliveryRequestProcessedKey =
  createServiceKey<IMarkDeliveryRequestProcessedHandler>("Comms.Repo.MarkDeliveryRequestProcessed");

// --- Delivery Attempt Repository ---
export const ICreateDeliveryAttemptRecordKey =
  createServiceKey<ICreateDeliveryAttemptRecordHandler>("Comms.Repo.CreateDeliveryAttemptRecord");
export const IFindDeliveryAttemptsByRequestIdKey =
  createServiceKey<IFindDeliveryAttemptsByRequestIdHandler>(
    "Comms.Repo.FindDeliveryAttemptsByRequestId",
  );
export const IUpdateDeliveryAttemptStatusKey =
  createServiceKey<IUpdateDeliveryAttemptStatusHandler>("Comms.Repo.UpdateDeliveryAttemptStatus");

// --- Channel Preference Repository ---
export const ICreateChannelPreferenceRecordKey =
  createServiceKey<ICreateChannelPreferenceRecordHandler>(
    "Comms.Repo.CreateChannelPreferenceRecord",
  );
export const IFindChannelPreferenceByContactIdKey =
  createServiceKey<IFindChannelPreferenceByContactIdHandler>(
    "Comms.Repo.FindChannelPreferenceByContactId",
  );
export const IUpdateChannelPreferenceRecordKey =
  createServiceKey<IUpdateChannelPreferenceRecordHandler>(
    "Comms.Repo.UpdateChannelPreferenceRecord",
  );

// --- Health Check Repository Handler ---
export const IPingDbKey = createServiceKey<IPingDbHandler>("Comms.Repo.PingDb");

// --- Job Repository ---
export const IPurgeDeletedMessagesKey = createServiceKey<IPurgeDeletedMessagesHandler>(
  "Comms.Repo.PurgeDeletedMessages",
);
export const IPurgeDeliveryHistoryKey = createServiceKey<IPurgeDeliveryHistoryHandler>(
  "Comms.Repo.PurgeDeliveryHistory",
);

// --- Providers ---
export const IEmailProviderKey = createServiceKey<IEmailProvider>("Comms.Infra.EmailProvider");
export const ISmsProviderKey = createServiceKey<ISmsProvider>("Comms.Infra.SmsProvider");

// =============================================================================
// Application-layer keys (defined and implemented in comms-app)
// =============================================================================

// --- Complex Handlers ---
export const IDeliverKey = createServiceKey<Deliver>("Comms.App.Deliver");
export const IRecipientResolverKey = createServiceKey<RecipientResolver>(
  "Comms.App.RecipientResolver",
);

// --- Command Handlers ---
export const ISetChannelPreferenceKey = createServiceKey<SetChannelPreference>(
  "Comms.App.SetChannelPreference",
);

// --- Query Handlers ---
export const IGetChannelPreferenceKey = createServiceKey<GetChannelPreference>(
  "Comms.App.GetChannelPreference",
);
export const ICheckHealthKey = createServiceKey<CheckHealth>("Comms.App.CheckHealth");

// --- Job Handlers (Command) ---
export const IRunDeletedMessagePurgeKey = createServiceKey<RunDeletedMessagePurge>(
  "Comms.App.RunDeletedMessagePurge",
);
export const IRunDeliveryHistoryPurgeKey = createServiceKey<RunDeliveryHistoryPurge>(
  "Comms.App.RunDeliveryHistoryPurge",
);
