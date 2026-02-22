import { Lifetime } from "./lifetime.js";
import type { ServiceDescriptor } from "./service-collection.js";
import type { ServiceKey } from "./service-key.js";

/**
 * Root service provider mirroring .NET's IServiceProvider.
 *
 * Resolution rules (matching .NET exactly):
 * - Singleton: Cached once in root, shared across all scopes.
 * - Scoped: Throws when resolved from root (must create a scope).
 * - Transient: New instance every resolve.
 *
 * Captive dependency prevention: Singleton factories receive the root provider
 * (can only depend on other singletons). Scoped factories receive the scope provider
 * (can depend on singletons + scoped).
 */
export class ServiceProvider {
  /** @internal */
  readonly _descriptors: ReadonlyMap<string, ServiceDescriptor>;
  /** @internal Singleton cache (shared across all scopes). */
  readonly _singletons = new Map<string, unknown>();
  private _disposed = false;

  /** @internal */
  constructor(descriptors: ReadonlyMap<string, ServiceDescriptor>) {
    this._descriptors = descriptors;

    // Pre-populate singletons registered via addInstance().
    for (const [id, desc] of descriptors) {
      if (desc.lifetime === Lifetime.Singleton && desc.instance !== undefined) {
        this._singletons.set(id, desc.instance);
      }
    }
  }

  /**
   * Resolve a service by key.
   * Throws if the key is not registered or if resolving a scoped service from root.
   */
  resolve<T>(key: ServiceKey<T>): T {
    this._ensureNotDisposed();
    const desc = this._descriptors.get(key.id);
    if (!desc) {
      throw new Error(`Service not registered: ${key.id}`);
    }
    return this._resolveDescriptor(desc) as T;
  }

  /**
   * Try to resolve a service by key.
   * Returns undefined if the key is not registered.
   * Still throws if resolving a scoped service from root.
   */
  tryResolve<T>(key: ServiceKey<T>): T | undefined {
    this._ensureNotDisposed();
    const desc = this._descriptors.get(key.id);
    if (!desc) return undefined;
    return this._resolveDescriptor(desc) as T;
  }

  /** Create a child scope for per-request lifetime management. */
  createScope(): ServiceScope {
    this._ensureNotDisposed();
    return new ServiceScope(this);
  }

  /** Dispose the provider, clearing all singleton caches. */
  dispose(): void {
    this._disposed = true;
    this._singletons.clear();
  }

  /** @internal */
  _resolveDescriptor(desc: ServiceDescriptor): unknown {
    switch (desc.lifetime) {
      case Lifetime.Singleton: {
        const cached = this._singletons.get(desc.key.id);
        if (cached !== undefined) return cached;
        // Factory receives root provider (captive dependency prevention).
        const instance = desc.factory!(this);
        this._singletons.set(desc.key.id, instance);
        return instance;
      }
      case Lifetime.Scoped:
        throw new Error(
          `Cannot resolve scoped service "${desc.key.id}" from the root provider. Create a scope first.`,
        );
      case Lifetime.Transient:
        return desc.factory!(this);
    }
  }

  /** @internal */
  _ensureNotDisposed(): void {
    if (this._disposed) {
      throw new Error("Cannot resolve from a disposed provider.");
    }
  }
}

/**
 * Child scope mirroring .NET's IServiceScope.
 *
 * Scoped services are cached per scope. Singletons delegate to root.
 * Transient services are always new.
 *
 * Supports TC39 explicit resource management via `[Symbol.dispose]()`.
 */
export class ServiceScope {
  private readonly _root: ServiceProvider;
  private readonly _scopedCache = new Map<string, unknown>();
  private _disposed = false;

  /** @internal */
  constructor(root: ServiceProvider) {
    this._root = root;
  }

  /**
   * Inject a pre-built value into this scope (e.g., per-request context).
   * Overrides any factory registration for the duration of this scope.
   */
  setInstance<T>(key: ServiceKey<T>, instance: T): void {
    this._ensureNotDisposed();
    this._scopedCache.set(key.id, instance);
  }

  /**
   * Resolve a service by key within this scope.
   * - Singleton: delegates to root.
   * - Scoped: cached per scope (or overridden via setInstance).
   * - Transient: new instance every time.
   */
  resolve<T>(key: ServiceKey<T>): T {
    this._ensureNotDisposed();
    const desc = this._root._descriptors.get(key.id);
    if (!desc) {
      throw new Error(`Service not registered: ${key.id}`);
    }
    return this._resolveDescriptor(desc) as T;
  }

  /**
   * Try to resolve a service by key within this scope.
   * Returns undefined if the key is not registered.
   */
  tryResolve<T>(key: ServiceKey<T>): T | undefined {
    this._ensureNotDisposed();
    const desc = this._root._descriptors.get(key.id);
    if (!desc) return undefined;
    return this._resolveDescriptor(desc) as T;
  }

  /** Create a child scope. Delegates to root. */
  createScope(): ServiceScope {
    this._ensureNotDisposed();
    return this._root.createScope();
  }

  /** Dispose this scope, clearing all scoped caches. */
  dispose(): void {
    this._disposed = true;
    this._scopedCache.clear();
  }

  /** TC39 explicit resource management support. */
  [Symbol.dispose](): void {
    this.dispose();
  }

  private _resolveDescriptor(desc: ServiceDescriptor): unknown {
    switch (desc.lifetime) {
      case Lifetime.Singleton: {
        // Singletons always resolve from root cache.
        const cached = this._root._singletons.get(desc.key.id);
        if (cached !== undefined) return cached;
        const instance = desc.factory!(this._root);
        this._root._singletons.set(desc.key.id, instance);
        return instance;
      }
      case Lifetime.Scoped: {
        const cached = this._scopedCache.get(desc.key.id);
        if (cached !== undefined) return cached;
        // Scoped factory receives the scope (can depend on singletons + scoped).
        const instance = desc.factory!(this as unknown as ServiceProvider);
        this._scopedCache.set(desc.key.id, instance);
        return instance;
      }
      case Lifetime.Transient:
        // Transient factory receives the scope (can depend on singletons + scoped).
        return desc.factory!(this as unknown as ServiceProvider);
    }
  }

  private _ensureNotDisposed(): void {
    if (this._disposed) {
      throw new Error("Cannot resolve from a disposed scope.");
    }
  }
}
