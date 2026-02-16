import * as grpc from "@grpc/grpc-js";
import { GeoServiceClientCtor, type GeoServiceClient } from "@d2/protos";
import { createApiKeyInterceptor } from "./api-key-interceptor.js";

/**
 * Creates a GeoServiceClient with the API key interceptor pre-wired.
 * Consumers should use this factory instead of creating the client directly.
 */
export function createGeoServiceClient(
  address: string,
  apiKey: string,
  credentials?: grpc.ChannelCredentials,
): GeoServiceClient {
  return new GeoServiceClientCtor(address, credentials ?? grpc.credentials.createInsecure(), {
    interceptors: [createApiKeyInterceptor(apiKey)],
  }) as unknown as GeoServiceClient;
}
