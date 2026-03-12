import type { ServiceCollection } from "@d2/di";
import type { HandlerContext } from "@d2/handler";
import * as CacheMemory from "@d2/cache-memory";
import {
  GetContactsByIds,
  IGetContactsByIdsKey,
  createGeoServiceClient,
  DEFAULT_GEO_CLIENT_OPTIONS,
} from "@d2/geo-client";

/**
 * Creates the Geo service client and registers the GetContactsByIds handler
 * as a singleton instance in the DI container.
 */
export function addGeoClientHandlers(
  services: ServiceCollection,
  config: { geoAddress?: string; geoApiKey?: string },
  serviceContext: HandlerContext,
): void {
  if (!config.geoAddress || !config.geoApiKey) {
    throw new Error(
      "GEO_GRPC_ADDRESS and GEO_API_KEY are required — comms service cannot start without Geo",
    );
  }

  const contactCacheStore = new CacheMemory.MemoryCacheStore();
  const geoClient = createGeoServiceClient(config.geoAddress, config.geoApiKey);
  const geoOptions = { ...DEFAULT_GEO_CLIENT_OPTIONS, apiKey: config.geoApiKey };

  const getContactsByIds = new GetContactsByIds(
    contactCacheStore,
    geoClient,
    geoOptions,
    serviceContext,
  );
  services.addInstance(IGetContactsByIdsKey, getContactsByIds);
}
