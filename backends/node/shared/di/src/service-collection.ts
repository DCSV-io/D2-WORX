import { Lifetime } from "./lifetime.js";
import { ServiceProvider, type ServiceResolver } from "./service-provider.js";
import type { ServiceKey } from "./service-key.js";

/** Internal registration descriptor. */
export interface ServiceDescriptor<T = unknown> {
  key: ServiceKey<T>;
  lifetime: Lifetime;
  factory?: (sp: ServiceResolver) => T;
  instance?: T;
}

/**
 * Registration builder mirroring .NET's IServiceCollection.
 *
 * Collects service descriptors and builds an immutable ServiceProvider.
 */
export class ServiceCollection {
  private readonly _descriptors = new Map<string, ServiceDescriptor>();

  /**
   * Register a singleton service created by a factory on first resolve.
   * The factory receives the root provider and can only depend on other singletons.
   */
  addSingleton<T>(key: ServiceKey<T>, factory: (sp: ServiceResolver) => T): this {
    this._descriptors.set(key.id, {
      key,
      lifetime: Lifetime.Singleton,
      factory: factory as (sp: ServiceResolver) => unknown,
    });
    return this;
  }

  /**
   * Register a scoped service created by a factory once per scope.
   * The factory receives the scope provider and can depend on singletons + other scoped services.
   */
  addScoped<T>(key: ServiceKey<T>, factory: (sp: ServiceResolver) => T): this {
    this._descriptors.set(key.id, {
      key,
      lifetime: Lifetime.Scoped,
      factory: factory as (sp: ServiceResolver) => unknown,
    });
    return this;
  }

  /**
   * Register a transient service created anew on every resolve.
   * The factory receives the current provider (root or scope).
   */
  addTransient<T>(key: ServiceKey<T>, factory: (sp: ServiceResolver) => T): this {
    this._descriptors.set(key.id, {
      key,
      lifetime: Lifetime.Transient,
      factory: factory as (sp: ServiceResolver) => unknown,
    });
    return this;
  }

  /**
   * Register a pre-built singleton instance (no factory needed).
   */
  addInstance<T>(key: ServiceKey<T>, instance: T): this {
    this._descriptors.set(key.id, {
      key,
      lifetime: Lifetime.Singleton,
      instance: instance as unknown,
    });
    return this;
  }

  /** Check whether a service key has been registered. */
  has<T>(key: ServiceKey<T>): boolean {
    return this._descriptors.has(key.id);
  }

  /** Build an immutable ServiceProvider from the current registrations. */
  build(): ServiceProvider {
    // Snapshot descriptors so mutations to the collection after build have no effect.
    const snapshot = new Map(this._descriptors);
    return new ServiceProvider(snapshot);
  }
}
