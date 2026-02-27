/**
 * Branded runtime token for DI registration and resolution.
 * Replaces erased TypeScript interfaces as DI keys.
 *
 * The phantom `_type` field carries the type information at compile time
 * without ever being assigned at runtime.
 */
export interface ServiceKey<T> {
  readonly id: string;
  /** Phantom type — never assigned, only used for type inference. */
  readonly _type: T;
}

/**
 * Creates a frozen ServiceKey with the given string identifier.
 * The type parameter `T` is carried as phantom type information.
 */
export function createServiceKey<T>(id: string): ServiceKey<T> {
  return Object.freeze({ id }) as ServiceKey<T>;
}
