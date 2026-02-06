interface CacheEntry<T> {
  value: T;
  expiresAt: number | undefined;
}

/**
 * Simple in-memory cache store backed by a Map with lazy TTL eviction.
 * Mirrors .NET's IMemoryCache (registered as singleton via AddMemoryCache).
 *
 * Singleton semantics are a composition concern — this class does not enforce it.
 */
export class MemoryCacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, expirationMs?: number): void {
    const expiresAt = expirationMs !== undefined ? Date.now() + expirationMs : undefined;
    this.store.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return false;
    }
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.store.clear();
  }
}
