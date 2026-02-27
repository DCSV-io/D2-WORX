import { createServiceKey } from "@d2/di";
import type { Notify } from "./handlers/pub/notify.js";

export const INotifyKey = createServiceKey<Notify>("CommsClient.Notify");
