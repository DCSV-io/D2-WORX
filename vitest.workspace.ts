import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "backends/node/shared/tests/vitest.config.ts",
  "backends/node/services/*/vitest.config.ts",
  "backends/node/services/*/tests/vitest.config.ts",
]);
