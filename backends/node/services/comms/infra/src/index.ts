// @d2/comms-infra — Infrastructure implementations for the Comms service.
// Drizzle repositories, Resend email provider, RabbitMQ consumers.

// --- Repository Handler Factories ---
export {
  createMessageRepoHandlers,
  createDeliveryRequestRepoHandlers,
  createDeliveryAttemptRepoHandlers,
  createChannelPreferenceRepoHandlers,
  createTemplateWrapperRepoHandlers,
} from "./repository/handlers/factories.js";

// --- Drizzle Schema ---
export {
  message,
  deliveryRequest,
  deliveryAttempt,
  channelPreference,
  templateWrapper,
} from "./repository/schema/index.js";

export type {
  MessageRow,
  NewMessage,
  DeliveryRequestRow,
  NewDeliveryRequest,
  DeliveryAttemptRow,
  NewDeliveryAttempt,
  ChannelPreferenceRow,
  NewChannelPreference,
  TemplateWrapperRow,
  NewTemplateWrapper,
} from "./repository/schema/index.js";

// --- Migrations ---
export { runMigrations } from "./repository/migrate.js";

// --- Providers ---
export { ResendEmailProvider } from "./providers/resend-email-provider.js";

// --- Messaging ---
export { createAuthEventConsumer } from "./messaging/consumers/auth-event-consumer.js";

// --- Templates ---
export { seedDefaultTemplates } from "./templates/default-templates.js";
