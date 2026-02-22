/**
 * Service lifetime, mirroring .NET's ServiceLifetime enum.
 *
 * - Singleton: One instance for the entire application lifetime.
 * - Scoped: One instance per scope (typically per-request).
 * - Transient: New instance every time the service is resolved.
 */
export enum Lifetime {
  Singleton = "Singleton",
  Scoped = "Scoped",
  Transient = "Transient",
}
