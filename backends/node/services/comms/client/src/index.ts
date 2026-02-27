// @d2/comms-client — Thin client for publishing notification requests to the Comms service.

export { Notify } from "./handlers/pub/notify.js";
export type { NotifyInput, NotifyOutput } from "./handlers/pub/notify.js";
export { INotifyKey } from "./service-keys.js";
export { COMMS_EVENTS } from "./comms-client-constants.js";
export { addCommsClient, type AddCommsClientOptions } from "./registration.js";
