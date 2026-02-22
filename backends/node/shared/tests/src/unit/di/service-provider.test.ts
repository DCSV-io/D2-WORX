import { describe, it, expect } from "vitest";
import { ServiceCollection, createServiceKey } from "@d2/di";

describe("ServiceProvider", () => {
  describe("Singleton", () => {
    it("should return the same instance across resolves", () => {
      const key = createServiceKey<{ id: number }>("singleton");
      const services = new ServiceCollection();
      let counter = 0;
      services.addSingleton(key, () => ({ id: ++counter }));
      const provider = services.build();

      const first = provider.resolve(key);
      const second = provider.resolve(key);

      expect(first).toBe(second);
      expect(first.id).toBe(1);
      provider.dispose();
    });

    it("should share singleton across scopes", () => {
      const key = createServiceKey<{ id: number }>("singleton");
      const services = new ServiceCollection();
      let counter = 0;
      services.addSingleton(key, () => ({ id: ++counter }));
      const provider = services.build();

      const fromRoot = provider.resolve(key);
      const scope1 = provider.createScope();
      const fromScope1 = scope1.resolve(key);
      const scope2 = provider.createScope();
      const fromScope2 = scope2.resolve(key);

      expect(fromRoot).toBe(fromScope1);
      expect(fromRoot).toBe(fromScope2);
      scope1.dispose();
      scope2.dispose();
      provider.dispose();
    });

    it("should return pre-built instance from addInstance", () => {
      const key = createServiceKey<string>("pre-built");
      const services = new ServiceCollection();
      services.addInstance(key, "hello-world");
      const provider = services.build();

      expect(provider.resolve(key)).toBe("hello-world");
      provider.dispose();
    });
  });

  describe("Transient", () => {
    it("should create a new instance every resolve", () => {
      const key = createServiceKey<{ id: number }>("transient");
      const services = new ServiceCollection();
      let counter = 0;
      services.addTransient(key, () => ({ id: ++counter }));
      const provider = services.build();

      const first = provider.resolve(key);
      const second = provider.resolve(key);

      expect(first).not.toBe(second);
      expect(first.id).toBe(1);
      expect(second.id).toBe(2);
      provider.dispose();
    });

    it("should create new instances from scopes too", () => {
      const key = createServiceKey<{ id: number }>("transient");
      const services = new ServiceCollection();
      let counter = 0;
      services.addTransient(key, () => ({ id: ++counter }));
      const provider = services.build();
      const scope = provider.createScope();

      const fromRoot = provider.resolve(key);
      const fromScope = scope.resolve(key);

      expect(fromRoot).not.toBe(fromScope);
      scope.dispose();
      provider.dispose();
    });
  });

  describe("Scoped", () => {
    it("should throw when resolving from root provider", () => {
      const key = createServiceKey<string>("scoped");
      const services = new ServiceCollection();
      services.addScoped(key, () => "value");
      const provider = services.build();

      expect(() => provider.resolve(key)).toThrow(/scoped.*root/i);
      provider.dispose();
    });

    it("should cache within a scope", () => {
      const key = createServiceKey<{ id: number }>("scoped");
      const services = new ServiceCollection();
      let counter = 0;
      services.addScoped(key, () => ({ id: ++counter }));
      const provider = services.build();
      const scope = provider.createScope();

      const first = scope.resolve(key);
      const second = scope.resolve(key);

      expect(first).toBe(second);
      expect(first.id).toBe(1);
      scope.dispose();
      provider.dispose();
    });

    it("should have different instances across scopes", () => {
      const key = createServiceKey<{ id: number }>("scoped");
      const services = new ServiceCollection();
      let counter = 0;
      services.addScoped(key, () => ({ id: ++counter }));
      const provider = services.build();

      const scope1 = provider.createScope();
      const scope2 = provider.createScope();
      const fromScope1 = scope1.resolve(key);
      const fromScope2 = scope2.resolve(key);

      expect(fromScope1).not.toBe(fromScope2);
      expect(fromScope1.id).toBe(1);
      expect(fromScope2.id).toBe(2);
      scope1.dispose();
      scope2.dispose();
      provider.dispose();
    });
  });

  describe("setInstance", () => {
    it("should override factory registration in scope", () => {
      const key = createServiceKey<string>("overridable");
      const services = new ServiceCollection();
      services.addScoped(key, () => "from-factory");
      const provider = services.build();
      const scope = provider.createScope();

      scope.setInstance(key, "from-setInstance");

      expect(scope.resolve(key)).toBe("from-setInstance");
      scope.dispose();
      provider.dispose();
    });

    it("should not affect other scopes", () => {
      const key = createServiceKey<string>("isolated");
      const services = new ServiceCollection();
      services.addScoped(key, () => "from-factory");
      const provider = services.build();

      const scope1 = provider.createScope();
      scope1.setInstance(key, "overridden");

      const scope2 = provider.createScope();

      expect(scope1.resolve(key)).toBe("overridden");
      expect(scope2.resolve(key)).toBe("from-factory");
      scope1.dispose();
      scope2.dispose();
      provider.dispose();
    });
  });

  describe("tryResolve", () => {
    it("should return undefined for unregistered keys", () => {
      const key = createServiceKey<string>("missing");
      const services = new ServiceCollection();
      const provider = services.build();

      expect(provider.tryResolve(key)).toBeUndefined();
      provider.dispose();
    });

    it("should return the service if registered", () => {
      const key = createServiceKey<string>("present");
      const services = new ServiceCollection();
      services.addSingleton(key, () => "found");
      const provider = services.build();

      expect(provider.tryResolve(key)).toBe("found");
      provider.dispose();
    });

    it("should return undefined for unregistered keys from scope", () => {
      const key = createServiceKey<string>("missing");
      const services = new ServiceCollection();
      const provider = services.build();
      const scope = provider.createScope();

      expect(scope.tryResolve(key)).toBeUndefined();
      scope.dispose();
      provider.dispose();
    });
  });

  describe("resolve errors", () => {
    it("should throw for unregistered keys", () => {
      const key = createServiceKey<string>("nope");
      const services = new ServiceCollection();
      const provider = services.build();

      expect(() => provider.resolve(key)).toThrow(/not registered/i);
      provider.dispose();
    });
  });

  describe("dispose", () => {
    it("should throw after provider dispose", () => {
      const key = createServiceKey<string>("test");
      const services = new ServiceCollection();
      services.addSingleton(key, () => "value");
      const provider = services.build();

      provider.dispose();

      expect(() => provider.resolve(key)).toThrow(/disposed/i);
    });

    it("should throw after scope dispose", () => {
      const key = createServiceKey<string>("test");
      const services = new ServiceCollection();
      services.addScoped(key, () => "value");
      const provider = services.build();
      const scope = provider.createScope();

      scope.dispose();

      expect(() => scope.resolve(key)).toThrow(/disposed/i);
      provider.dispose();
    });

    it("should not affect other scopes when one is disposed", () => {
      const key = createServiceKey<{ id: number }>("scoped");
      const services = new ServiceCollection();
      let counter = 0;
      services.addScoped(key, () => ({ id: ++counter }));
      const provider = services.build();

      const scope1 = provider.createScope();
      const scope2 = provider.createScope();
      scope1.resolve(key);

      scope1.dispose();

      // scope2 should still work
      expect(() => scope2.resolve(key)).not.toThrow();
      scope2.dispose();
      provider.dispose();
    });

    it("should support Symbol.dispose on scope", () => {
      const key = createServiceKey<string>("test");
      const services = new ServiceCollection();
      services.addScoped(key, () => "value");
      const provider = services.build();
      const scope = provider.createScope();

      // Symbol.dispose should work
      scope[Symbol.dispose]();

      expect(() => scope.resolve(key)).toThrow(/disposed/i);
      provider.dispose();
    });
  });

  describe("captive dependency prevention", () => {
    it("should throw when singleton factory tries to resolve scoped", () => {
      const scopedKey = createServiceKey<{ requestId: string }>("scoped-dep");
      const singletonKey = createServiceKey<{ value: string }>("singleton-with-scoped");

      const services = new ServiceCollection();
      services.addScoped(scopedKey, () => ({ requestId: "req-1" }));
      services.addSingleton(singletonKey, (sp) => ({
        value: sp.resolve(scopedKey).requestId,
      }));
      const provider = services.build();

      // Singleton factory receives root provider, which cannot resolve scoped
      expect(() => provider.resolve(singletonKey)).toThrow(/scoped.*root/i);
      provider.dispose();
    });

    it("should still throw for tryResolve of scoped key from root", () => {
      const scopedKey = createServiceKey<string>("scoped-try");
      const services = new ServiceCollection();
      services.addScoped(scopedKey, () => "scoped-value");
      const provider = services.build();

      // tryResolve returns undefined for unregistered keys, but still throws for scoped from root
      expect(() => provider.tryResolve(scopedKey)).toThrow(/scoped.*root/i);
      provider.dispose();
    });
  });

  describe("dependency resolution", () => {
    it("should allow transient to depend on singleton", () => {
      const singletonKey = createServiceKey<{ name: string }>("config");
      const transientKey = createServiceKey<{ greeting: string }>("greeter");

      const services = new ServiceCollection();
      services.addSingleton(singletonKey, () => ({ name: "World" }));
      services.addTransient(transientKey, (sp) => ({
        greeting: `Hello, ${sp.resolve(singletonKey).name}!`,
      }));
      const provider = services.build();
      const scope = provider.createScope();

      expect(scope.resolve(transientKey).greeting).toBe("Hello, World!");
      scope.dispose();
      provider.dispose();
    });

    it("should allow transient to depend on scoped within a scope", () => {
      const scopedKey = createServiceKey<{ requestId: string }>("request");
      const transientKey = createServiceKey<{ id: string }>("handler");

      const services = new ServiceCollection();
      services.addScoped(scopedKey, () => ({ requestId: "req-1" }));
      services.addTransient(transientKey, (sp) => ({
        id: sp.resolve(scopedKey).requestId,
      }));
      const provider = services.build();
      const scope = provider.createScope();

      expect(scope.resolve(transientKey).id).toBe("req-1");
      scope.dispose();
      provider.dispose();
    });

    it("should provide setInstance values to transient factories", () => {
      const contextKey = createServiceKey<{ userId: string }>("context");
      const handlerKey = createServiceKey<{ user: string }>("handler");

      const services = new ServiceCollection();
      services.addScoped(contextKey, () => ({ userId: "default" }));
      services.addTransient(handlerKey, (sp) => ({
        user: sp.resolve(contextKey).userId,
      }));
      const provider = services.build();
      const scope = provider.createScope();

      // Override with per-request value
      scope.setInstance(contextKey, { userId: "user-123" });

      expect(scope.resolve(handlerKey).user).toBe("user-123");
      scope.dispose();
      provider.dispose();
    });
  });
});
