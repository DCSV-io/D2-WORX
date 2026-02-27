import type { IHandler } from "@d2/handler";
import type { GeoRefDataUpdatedEvent } from "@d2/protos";

export interface UpdatedOutput {}

export type IUpdatedHandler = IHandler<GeoRefDataUpdatedEvent, UpdatedOutput>;
