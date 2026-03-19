import type { IHandler } from "@d2/handler";
import type { NotifyInput, NotifyOutput } from "../../handlers/pub/notify.js";

export type { NotifyInput, NotifyOutput };

/** Handler interface for publishing notification requests to the Comms service. */
export interface INotifyHandler extends IHandler<NotifyInput, NotifyOutput> {}
