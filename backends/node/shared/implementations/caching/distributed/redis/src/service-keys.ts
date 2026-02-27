import { createServiceKey, type ServiceKey } from "@d2/di";
import type { DistributedCache } from "@d2/interfaces";

/** DI key for the Redis connection instance (singleton). */
export const IRedisKey = createServiceKey<import("ioredis").default>("Redis");

/** DI key for the Redis cache Ping handler. */
export const ICachePingKey =
  createServiceKey<DistributedCache.IPingHandler>("DistributedCache.Ping");

/** DI key for a typed Redis cache Get handler. */
export function createRedisGetKey<T>(
  qualifier: string,
): ServiceKey<DistributedCache.IGetHandler<T>> {
  return createServiceKey<DistributedCache.IGetHandler<T>>(`DistributedCache.Get:${qualifier}`);
}

/** DI key for a typed Redis cache Set handler. */
export function createRedisSetKey<T>(
  qualifier: string,
): ServiceKey<DistributedCache.ISetHandler<T>> {
  return createServiceKey<DistributedCache.ISetHandler<T>>(`DistributedCache.Set:${qualifier}`);
}

/** DI key for a typed Redis cache SetNx handler. */
export function createRedisSetNxKey<T>(
  qualifier: string,
): ServiceKey<DistributedCache.ISetNxHandler<T>> {
  return createServiceKey<DistributedCache.ISetNxHandler<T>>(`DistributedCache.SetNx:${qualifier}`);
}

/** DI key for the Redis cache Remove handler. */
export function createRedisRemoveKey(
  qualifier: string,
): ServiceKey<DistributedCache.IRemoveHandler> {
  return createServiceKey<DistributedCache.IRemoveHandler>(`DistributedCache.Remove:${qualifier}`);
}

/** DI key for the Redis cache Exists handler. */
export function createRedisExistsKey(
  qualifier: string,
): ServiceKey<DistributedCache.IExistsHandler> {
  return createServiceKey<DistributedCache.IExistsHandler>(`DistributedCache.Exists:${qualifier}`);
}

/** DI key for the Redis cache GetTtl handler. */
export function createRedisGetTtlKey(
  qualifier: string,
): ServiceKey<DistributedCache.IGetTtlHandler> {
  return createServiceKey<DistributedCache.IGetTtlHandler>(`DistributedCache.GetTtl:${qualifier}`);
}

/** DI key for the Redis cache Increment handler. */
export function createRedisIncrementKey(
  qualifier: string,
): ServiceKey<DistributedCache.IIncrementHandler> {
  return createServiceKey<DistributedCache.IIncrementHandler>(
    `DistributedCache.Increment:${qualifier}`,
  );
}
