import { createServiceKey, type ServiceKey } from "@d2/di";
import type { InMemoryCache } from "@d2/interfaces";
import type { MemoryCacheStore } from "./memory-cache-store.js";

/** DI key for a MemoryCacheStore instance (singleton per cache domain). */
export function createMemoryCacheStoreKey(qualifier: string): ServiceKey<MemoryCacheStore> {
  return createServiceKey<MemoryCacheStore>(`MemoryCacheStore:${qualifier}`);
}

/** DI key for a typed in-memory cache Get handler. */
export function createMemCacheGetKey<T>(
  qualifier: string,
): ServiceKey<InMemoryCache.IGetHandler<T>> {
  return createServiceKey<InMemoryCache.IGetHandler<T>>(`InMemoryCache.Get:${qualifier}`);
}

/** DI key for a typed in-memory cache GetMany handler. */
export function createMemCacheGetManyKey<T>(
  qualifier: string,
): ServiceKey<InMemoryCache.IGetManyHandler<T>> {
  return createServiceKey<InMemoryCache.IGetManyHandler<T>>(`InMemoryCache.GetMany:${qualifier}`);
}

/** DI key for a typed in-memory cache Set handler. */
export function createMemCacheSetKey<T>(
  qualifier: string,
): ServiceKey<InMemoryCache.ISetHandler<T>> {
  return createServiceKey<InMemoryCache.ISetHandler<T>>(`InMemoryCache.Set:${qualifier}`);
}

/** DI key for a typed in-memory cache SetMany handler. */
export function createMemCacheSetManyKey<T>(
  qualifier: string,
): ServiceKey<InMemoryCache.ISetManyHandler<T>> {
  return createServiceKey<InMemoryCache.ISetManyHandler<T>>(`InMemoryCache.SetMany:${qualifier}`);
}

/** DI key for the in-memory cache Remove handler. */
export function createMemCacheRemoveKey(
  qualifier: string,
): ServiceKey<InMemoryCache.IRemoveHandler> {
  return createServiceKey<InMemoryCache.IRemoveHandler>(`InMemoryCache.Remove:${qualifier}`);
}
