/** Pluggable serializer for Redis cache values. */
export interface ICacheSerializer<T> {
  serialize(value: T): string | Buffer;
  deserialize(raw: Buffer): T;
}

/** Default JSON serializer (mirrors .NET JsonSerializer path). */
export class JsonCacheSerializer<T> implements ICacheSerializer<T> {
  serialize(value: T): string {
    return JSON.stringify(value);
  }

  deserialize(raw: Buffer): T {
    return JSON.parse(raw.toString("utf-8")) as T;
  }
}
