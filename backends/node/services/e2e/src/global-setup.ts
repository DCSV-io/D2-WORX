import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Pre-builds a .NET project so tests can use `dotnet run --no-build`.
 */
function buildDotnetProject(name: string, projectDir: string): void {
  console.log(`[E2E Global Setup] Building ${name}...`);
  try {
    execSync(`dotnet build "${projectDir}" --configuration Debug`, {
      stdio: "pipe",
      timeout: 120_000,
    });
    console.log(`[E2E Global Setup] ${name} build complete.`);
  } catch (err) {
    console.error(`[E2E Global Setup] ${name} build failed:`, (err as Error).message);
    throw err;
  }
}

/**
 * Global setup for E2E tests — pre-builds .NET projects so individual
 * test files can use `dotnet run --no-build` without competing for
 * build output locks.
 *
 * Builds sequentially to avoid MSBuild lock contention on shared
 * project references.
 */
export async function setup() {
  const geoApiDir = resolve(
    import.meta.dirname,
    "../../../../../backends/dotnet/services/Geo/Geo.API",
  );

  const gatewayDir = resolve(
    import.meta.dirname,
    "../../../../../backends/dotnet/gateways/REST",
  );

  buildDotnetProject("Geo.API", geoApiDir);
  buildDotnetProject("REST Gateway", gatewayDir);
}
