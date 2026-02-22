import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.js";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      name: "e2e-tests",
      setupFiles: ["./src/setup.ts"],
      globalSetup: ["./src/global-setup.ts"],
      testTimeout: 30_000,
      hookTimeout: 180_000,
      // Run test files sequentially to avoid .NET build lock contention
      // (each test file starts its own Geo.API child process)
      fileParallelism: false,
    },
  }),
);
