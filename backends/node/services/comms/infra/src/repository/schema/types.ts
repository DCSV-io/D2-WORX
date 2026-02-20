import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  message,
  deliveryRequest,
  deliveryAttempt,
  channelPreference,
  templateWrapper,
} from "./tables.js";

export type MessageRow = InferSelectModel<typeof message>;
export type NewMessage = InferInsertModel<typeof message>;

export type DeliveryRequestRow = InferSelectModel<typeof deliveryRequest>;
export type NewDeliveryRequest = InferInsertModel<typeof deliveryRequest>;

export type DeliveryAttemptRow = InferSelectModel<typeof deliveryAttempt>;
export type NewDeliveryAttempt = InferInsertModel<typeof deliveryAttempt>;

export type ChannelPreferenceRow = InferSelectModel<typeof channelPreference>;
export type NewChannelPreference = InferInsertModel<typeof channelPreference>;

export type TemplateWrapperRow = InferSelectModel<typeof templateWrapper>;
export type NewTemplateWrapper = InferInsertModel<typeof templateWrapper>;
