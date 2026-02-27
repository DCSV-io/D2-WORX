import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Global setup for E2E tests — pre-builds the .NET Geo.API project
 * so individual test files can use `dotnet run --no-build` without
 * competing for build output locks.
 */
export async function setup() {
  const projectDir = resolve(
    import.meta.dirname,
    "../../../../../backends/dotnet/services/Geo/Geo.API",
  );

  console.log("[E2E Global Setup] Building Geo.API...");
  try {
    execSync(`dotnet build "${projectDir}" --configuration Debug`, {
      stdio: "pipe",
      timeout: 120_000,
    });
    console.log("[E2E Global Setup] Geo.API build complete.");
  } catch (err) {
    console.error("[E2E Global Setup] Geo.API build failed:", (err as Error).message);
    throw err;
  }
}
