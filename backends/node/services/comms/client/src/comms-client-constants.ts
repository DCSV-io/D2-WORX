/**
 * Comms client messaging topology constants.
 *
 * Used by the comms-client publisher and the comms-infra consumer
 * to agree on exchange/queue naming.
 */
export const COMMS_EVENTS = {
  /** RabbitMQ fanout exchange for notification requests. */
  NOTIFICATIONS_EXCHANGE: "comms.notifications",
  /** Exchange type — fanout broadcasts to all bound queues. */
  NOTIFICATIONS_EXCHANGE_TYPE: "fanout" as const,
} as const;
