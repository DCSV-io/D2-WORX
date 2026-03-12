/**
 * Playwright global teardown for Tier 2 browser E2E tests.
 *
 * Stops everything in reverse order: SvelteKit → Comms → Auth → Geo → Containers.
 */
import { stopSvelteKitServer } from "../helpers/sveltekit-server.js";
import { stopCommsService } from "../helpers/comms-service.js";
import { stopAuthService } from "../helpers/auth-service.js";
import { stopGeoService } from "../helpers/geo-dotnet-service.js";
import { stopContainers } from "../helpers/containers.js";

export default async function globalTeardown() {
  console.log("[Browser E2E] Shutting down...");

  await stopSvelteKitServer();
  await stopCommsService();
  await stopAuthService();
  await stopGeoService();
  await stopContainers();

  console.log("[Browser E2E] Shutdown complete.");
}
