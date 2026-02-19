// @d2/comms-domain — Pure domain types for the Comms service.

// --- Constants ---
export {
  RETRY_POLICY,
  DELIVERY_DEFAULTS,
  CHANNEL_DEFAULTS,
  QUIET_HOURS,
  THREAD_CONSTRAINTS,
} from "./constants/comms-constants.js";

// --- Enums ---
export { CHANNELS, isValidChannel } from "./enums/channel.js";
export type { Channel } from "./enums/channel.js";

export {
  DELIVERY_STATUSES,
  DELIVERY_STATUS_TRANSITIONS,
  isValidDeliveryStatus,
} from "./enums/delivery-status.js";
export type { DeliveryStatus } from "./enums/delivery-status.js";

export { URGENCIES, isValidUrgency } from "./enums/urgency.js";
export type { Urgency } from "./enums/urgency.js";

export {
  NOTIFICATION_POLICIES,
  isValidNotificationPolicy,
} from "./enums/notification-policy.js";
export type { NotificationPolicy } from "./enums/notification-policy.js";

export { THREAD_TYPES, isValidThreadType } from "./enums/thread-type.js";
export type { ThreadType } from "./enums/thread-type.js";

export {
  THREAD_STATES,
  THREAD_STATE_TRANSITIONS,
  isValidThreadState,
} from "./enums/thread-state.js";
export type { ThreadState } from "./enums/thread-state.js";

export {
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_HIERARCHY,
  isValidParticipantRole,
} from "./enums/participant-role.js";
export type { ParticipantRole } from "./enums/participant-role.js";

export { CONTENT_FORMATS, isValidContentFormat } from "./enums/content-format.js";
export type { ContentFormat } from "./enums/content-format.js";

// --- Exceptions ---
export { CommsDomainError } from "./exceptions/comms-domain-error.js";
export { CommsValidationError } from "./exceptions/comms-validation-error.js";

// --- Entities: Core ---
export { createMessage, editMessage, softDeleteMessage } from "./entities/message.js";
export type { Message, CreateMessageInput } from "./entities/message.js";

// --- Entities: Delivery Engine ---
export {
  createDeliveryRequest,
  markDeliveryRequestProcessed,
} from "./entities/delivery-request.js";
export type {
  DeliveryRequest,
  CreateDeliveryRequestInput,
} from "./entities/delivery-request.js";

export {
  createDeliveryAttempt,
  transitionDeliveryAttemptStatus,
} from "./entities/delivery-attempt.js";
export type {
  DeliveryAttempt,
  CreateDeliveryAttemptInput,
  TransitionDeliveryAttemptOptions,
} from "./entities/delivery-attempt.js";

export {
  createChannelPreference,
  updateChannelPreference,
} from "./entities/channel-preference.js";
export type {
  ChannelPreference,
  CreateChannelPreferenceInput,
  UpdateChannelPreferenceInput,
} from "./entities/channel-preference.js";

export {
  createTemplateWrapper,
  updateTemplateWrapper,
} from "./entities/template-wrapper.js";
export type {
  TemplateWrapper,
  CreateTemplateWrapperInput,
  UpdateTemplateWrapperInput,
} from "./entities/template-wrapper.js";

// --- Entities: Read Tracking ---
export { createMessageReceipt } from "./entities/message-receipt.js";
export type { MessageReceipt, CreateMessageReceiptInput } from "./entities/message-receipt.js";

// --- Entities: Threads ---
export {
  createThread,
  updateThread,
  transitionThreadState,
} from "./entities/thread.js";
export type { Thread, CreateThreadInput, UpdateThreadInput } from "./entities/thread.js";

export {
  createThreadParticipant,
  updateThreadParticipant,
  markParticipantLeft,
} from "./entities/thread-participant.js";
export type {
  ThreadParticipant,
  CreateThreadParticipantInput,
  UpdateThreadParticipantInput,
} from "./entities/thread-participant.js";

// --- Entities: Message Extras ---
export { createMessageAttachment } from "./entities/message-attachment.js";
export type {
  MessageAttachment,
  CreateMessageAttachmentInput,
} from "./entities/message-attachment.js";

export { createMessageReaction } from "./entities/message-reaction.js";
export type {
  MessageReaction,
  CreateMessageReactionInput,
} from "./entities/message-reaction.js";

// --- Value Objects ---
export type { ResolvedChannels, QuietHoursResult } from "./value-objects/resolved-channels.js";

// --- Business Rules ---
export { isInQuietHours } from "./rules/quiet-hours.js";
export { resolveChannels } from "./rules/channel-resolution.js";
export {
  computeRetryDelay,
  isMaxAttemptsReached,
  computeNextRetryAt,
} from "./rules/retry-policy.js";
export {
  canPostMessage,
  canEditMessage,
  canDeleteMessage,
  canManageParticipants,
  canManageThread,
  canAddReaction,
} from "./rules/thread-permissions.js";
export { hasValidRecipient, describeRecipient } from "./rules/recipient-validation.js";
export { hasValidSender } from "./rules/message-validation.js";
