export { type GeoClientOptions, DEFAULT_GEO_CLIENT_OPTIONS } from "./geo-client-options.js";
export type { GeoRefDataUpdated } from "./messages/geo-ref-data-updated.js";

// Interfaces (contract types + handler interfaces + redaction constants)
export { Commands, Queries, Complex } from "./interfaces/index.js";
export type { Subs } from "./interfaces/index.js";

// Commands
export { ReqUpdate } from "./handlers/c/req-update.js";
export type { ReqUpdateInput, ReqUpdateOutput } from "./interfaces/c/req-update.js";
export { SetInMem } from "./handlers/c/set-in-mem.js";
export type { SetInMemInput, SetInMemOutput } from "./interfaces/c/set-in-mem.js";
export { SetInDist, GeoRefDataSerializer } from "./handlers/c/set-in-dist.js";
export type { SetInDistInput, SetInDistOutput } from "./interfaces/c/set-in-dist.js";
export { SetOnDisk } from "./handlers/c/set-on-disk.js";
export type { SetOnDiskInput, SetOnDiskOutput } from "./interfaces/c/set-on-disk.js";

// Queries
export { GetFromMem } from "./handlers/q/get-from-mem.js";
export type { GetFromMemInput, GetFromMemOutput } from "./interfaces/q/get-from-mem.js";
export { GetFromDist } from "./handlers/q/get-from-dist.js";
export type { GetFromDistInput, GetFromDistOutput } from "./interfaces/q/get-from-dist.js";
export { GetFromDisk } from "./handlers/q/get-from-disk.js";
export type { GetFromDiskInput, GetFromDiskOutput } from "./interfaces/q/get-from-disk.js";

// Complex
export { FindWhoIs } from "./handlers/x/find-whois.js";
export type { FindWhoIsInput, FindWhoIsOutput } from "./interfaces/x/find-whois.js";
export { Get, type GetDeps } from "./handlers/x/get.js";
export type { GetInput, GetOutput } from "./interfaces/x/get.js";

// Messaging
export { Updated, type UpdatedDeps } from "./messaging/handlers/sub/updated.js";
export type { UpdatedOutput } from "./interfaces/sub/updated.js";
export { createUpdatedConsumer } from "./messaging/consumers/updated-consumer.js";
