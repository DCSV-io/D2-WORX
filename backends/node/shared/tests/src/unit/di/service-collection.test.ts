import { describe, it, expect } from "vitest";
import { ServiceCollection, createServiceKey, Lifetime } from "@d2/di";

describe("ServiceCollection", () => {
  it("should register a singleton factory", () => {
    const key = createServiceKey<string>("test");
    const services = new ServiceCollection();
    services.addSingleton(key, () => "hello");
    expect(services.has(key)).toBe(true);
  });

  it("should register a scoped factory", () => {
    const key = createServiceKey<string>("test");
    const services = new ServiceCollection();
    services.addScoped(key, () => "hello");
    expect(services.has(key)).toBe(true);
  });

  it("should register a transient factory", () => {
    const key = createServiceKey<string>("test");
    const services = new ServiceCollection();
    services.addTransient(key, () => "hello");
    expect(services.has(key)).toBe(true);
  });

  it("should register a pre-built instance", () => {
    const key = createServiceKey<string>("test");
    const services = new ServiceCollection();
    services.addInstance(key, "world");
    expect(services.has(key)).toBe(true);
  });

  it("should return false for unregistered keys", () => {
    const key = createServiceKey<string>("not-registered");
    const services = new ServiceCollection();
    expect(services.has(key)).toBe(false);
  });

  it("should support method chaining", () => {
    const k1 = createServiceKey<string>("a");
    const k2 = createServiceKey<number>("b");
    const services = new ServiceCollection();
    const result = services.addSingleton(k1, () => "x").addTransient(k2, () => 42);
    expect(result).toBe(services);
  });

  it("should allow overwriting a registration (last-wins, like .NET)", () => {
    const key = createServiceKey<string>("dup");
    const services = new ServiceCollection();
    services.addSingleton(key, () => "first");
    services.addSingleton(key, () => "second");
    const provider = services.build();
    expect(provider.resolve(key)).toBe("second");
    provider.dispose();
  });

  it("should build a ServiceProvider", () => {
    const key = createServiceKey<string>("test");
    const services = new ServiceCollection();
    services.addSingleton(key, () => "built");
    const provider = services.build();
    expect(provider).toBeDefined();
    provider.dispose();
  });
});
