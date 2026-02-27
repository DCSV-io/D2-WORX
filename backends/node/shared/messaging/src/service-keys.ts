import { createServiceKey } from "@d2/di";
import type { Messaging } from "@d2/interfaces";
import type { MessageBus } from "./message-bus.js";

/** DI key for the MessageBus connection instance (singleton). */
export const IMessageBusKey = createServiceKey<MessageBus>("MessageBus");

/** DI key for the MessageBus Ping handler. */
export const IMessageBusPingKey = createServiceKey<Messaging.IPingHandler>("Messaging.Ping");
