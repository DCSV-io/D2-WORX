import type { ServiceCollection } from "@d2/di";
import { IHandlerContextKey } from "@d2/handler";
import type { IMessagePublisher } from "@d2/messaging";
import { INotifyKey } from "./service-keys.js";
import { Notify } from "./handlers/pub/notify.js";

export interface AddCommsClientOptions {
  publisher?: IMessagePublisher;
}

/**
 * Registers comms-client services with the DI container.
 * Mirrors `addAuthApp()` / `addCommsApp()` registration pattern.
 */
export function addCommsClient(services: ServiceCollection, options: AddCommsClientOptions): void {
  services.addTransient(
    INotifyKey,
    (sp) => new Notify(sp.resolve(IHandlerContextKey), options.publisher),
  );
}
