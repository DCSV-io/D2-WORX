import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const shared = resolve(import.meta.dirname, "shared");
const impl = resolve(shared, "implementations");

/**
 * Shared Vitest configuration inherited by all test projects.
 *
 * resolve.alias maps @d2/* workspace imports to their TypeScript source
 * so V8 coverage can instrument the actual source files instead of
 * compiled dist/ output.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@d2/result": resolve(shared, "result/src/index.ts"),
      "@d2/utilities": resolve(shared, "utilities/src/index.ts"),
      "@d2/protos": resolve(shared, "protos/src/index.ts"),
      "@d2/logging": resolve(shared, "logging/src/index.ts"),
      "@d2/service-defaults": resolve(shared, "service-defaults/src/index.ts"),
      "@d2/handler": resolve(shared, "handler/src/index.ts"),
      "@d2/interfaces": resolve(shared, "interfaces/src/index.ts"),
      "@d2/result-extensions": resolve(shared, "result-extensions/src/index.ts"),
      "@d2/testing": resolve(shared, "testing/src/index.ts"),
      "@d2/cache-memory": resolve(impl, "caching/memory/src/index.ts"),
      "@d2/cache-redis": resolve(impl, "caching/redis/src/index.ts"),
      "@d2/messaging": resolve(shared, "messaging/src/index.ts"),
      "@d2/geo-client": resolve(import.meta.dirname, "services/geo/geo-client/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10_000,
    hookTimeout: 60_000,
    restoreMocks: true,
    include: ["**/*.test.ts", "**/*.spec.ts"],
  },
});
