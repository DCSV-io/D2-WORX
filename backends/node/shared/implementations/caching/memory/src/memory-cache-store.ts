interface CacheEntry<T> {
  value: T;
  expiresAt: number | undefined;
}

export interface MemoryCacheStoreOptions {
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;

/**
 * In-memory cache store backed by a Map with lazy TTL eviction and always-on LRU.
 * Mirrors .NET's IMemoryCache (registered as singleton via AddMemoryCache).
 *
 * LRU uses Map insertion-order trick: delete + re-insert on get promotes to MRU.
 * When at capacity, the first (oldest-accessed) entry is evicted on set.
 *
 * Singleton semantics are a composition concern — this class does not enforce it.
 */
export class MemoryCacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries: number;

  constructor(options?: MemoryCacheStoreOptions) {
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  get size(): number {
    return this.store.size;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    // LRU promote: delete + re-insert moves to end (MRU position)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, expirationMs?: number): void {
    // Delete first to update insertion order if key already exists
    this.store.delete(key);

    // Evict LRU (first entry in Map) if at capacity
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) {
        this.store.delete(oldest.value);
      }
    }

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
