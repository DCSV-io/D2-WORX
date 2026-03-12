import * as grpc from "@grpc/grpc-js";
import { GeoServiceClientCtor, type GeoServiceClient } from "@d2/protos";
import { createTraceContextInterceptor } from "@d2/service-defaults/grpc";
import { createApiKeyInterceptor } from "./api-key-interceptor.js";

/**
 * Creates a GeoServiceClient with trace context propagation and
 * API key authentication interceptors pre-wired.
 * Consumers should use this factory instead of creating the client directly.
 */
export function createGeoServiceClient(
  address: string,
  apiKey: string,
  credentials?: grpc.ChannelCredentials,
): GeoServiceClient {
  return new GeoServiceClientCtor(address, credentials ?? grpc.credentials.createInsecure(), {
    interceptors: [createTraceContextInterceptor(), createApiKeyInterceptor(apiKey)],
  }) as unknown as GeoServiceClient;
}
