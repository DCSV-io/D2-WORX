import { Lifetime } from "./lifetime.js";
import type { ServiceDescriptor } from "./service-collection.js";
import type { ServiceKey } from "./service-key.js";

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
const _g = globalThis as Record<string, unknown>;
const _proc = _g.process as { env?: Record<string, string | undefined> } | undefined;
const DEBUG = _proc?.env?.DEBUG_DI === "true";
/* eslint-enable @typescript-eslint/no-unsafe-member-access */

function debugLog(msg: string): void {
  if (DEBUG) (globalThis as { console?: { debug?: (...a: unknown[]) => void } }).console?.debug?.(`[DI] ${msg}`);
}

/**
 * Shared resolution interface implemented by both ServiceProvider and ServiceScope.
 * Used as the factory parameter type in ServiceDescriptor to avoid unsafe casts.
 */
export interface ServiceResolver {
  resolve<T>(key: ServiceKey<T>): T;
  tryResolve<T>(key: ServiceKey<T>): T | undefined;
}

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
export class ServiceProvider implements ServiceResolver {
  /** @internal */
  readonly _descriptors: ReadonlyMap<string, ServiceDescriptor>;
  /** @internal Singleton cache (shared across all scopes). */
  readonly _singletons = new Map<string, unknown>();
  /** @internal Tracks keys currently being resolved to detect circular dependencies. */
  readonly _resolvingStack = new Set<string>();
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
    debugLog(`Resolving ${key.id} (lifetime: ${Lifetime[desc.lifetime]})`);
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
        if (this._singletons.has(desc.key.id)) {
          debugLog(`Singleton cache hit: ${desc.key.id}`);
          return this._singletons.get(desc.key.id);
        }
        // Factory receives root provider (captive dependency prevention).
        const instance = this._invokeFactory(desc, this);
        this._singletons.set(desc.key.id, instance);
        return instance;
      }
      case Lifetime.Scoped:
        throw new Error(
          `Cannot resolve scoped service "${desc.key.id}" from the root provider. Create a scope first.`,
        );
      case Lifetime.Transient:
        return this._invokeFactory(desc, this);
    }
  }

  /**
   * Invoke a factory with circular dependency detection.
   * Tracks the resolution stack and throws if a cycle is detected.
   * @internal
   */
  _invokeFactory(desc: ServiceDescriptor, resolver: ServiceResolver): unknown {
    const keyId = desc.key.id;
    if (this._resolvingStack.has(keyId)) {
      const chain = [...this._resolvingStack, keyId].join(" -> ");
      debugLog(`CIRCULAR: ${chain}`);
      throw new Error(`Circular dependency detected: ${chain}`);
    }
    this._resolvingStack.add(keyId);
    try {
      debugLog(`Creating ${keyId} via factory`);
      return desc.factory!(resolver);
    } finally {
      this._resolvingStack.delete(keyId);
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
export class ServiceScope implements ServiceResolver {
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
    debugLog(`setInstance: ${key.id}`);
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
    debugLog(`Resolving ${key.id} (lifetime: ${Lifetime[desc.lifetime]}, scope)`);
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
        if (this._root._singletons.has(desc.key.id)) {
          debugLog(`Singleton cache hit: ${desc.key.id}`);
          return this._root._singletons.get(desc.key.id);
        }
        const instance = this._root._invokeFactory(desc, this._root);
        this._root._singletons.set(desc.key.id, instance);
        return instance;
      }
      case Lifetime.Scoped: {
        if (this._scopedCache.has(desc.key.id)) {
          debugLog(`Scope cache hit: ${desc.key.id}`);
          return this._scopedCache.get(desc.key.id);
        }
        // Scoped factory receives the scope (can depend on singletons + scoped).
        const instance = this._root._invokeFactory(desc, this);
        this._scopedCache.set(desc.key.id, instance);
        return instance;
      }
      case Lifetime.Transient:
        // Transient factory receives the scope (can depend on singletons + scoped).
        return this._root._invokeFactory(desc, this);
    }
  }

  private _ensureNotDisposed(): void {
    if (this._disposed) {
      throw new Error("Cannot resolve from a disposed scope.");
    }
  }
}
