import type { IHandler } from "@d2/handler";
import type { GeoRefDataUpdated } from "../../messages/geo-ref-data-updated.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdatedOutput {}

export type IUpdatedHandler = IHandler<GeoRefDataUpdated, UpdatedOutput>;
