import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import net from "node:net";

let geoProcess: ChildProcess | undefined;
let geoPort: number | undefined;

/**
 * Converts a PostgreSQL URI to ADO.NET key-value format for .NET Npgsql.
 * Input:  postgresql://test:test@localhost:32779/test
 * Output: Host=localhost;Port=32779;Database=test;Username=test;Password=test
 */
function pgUriToAdoNet(uri: string): string {
  const url = new URL(uri);
  return [
    `Host=${url.hostname}`,
    `Port=${url.port}`,
    `Database=${url.pathname.slice(1)}`,
    `Username=${decodeURIComponent(url.username)}`,
    `Password=${decodeURIComponent(url.password)}`,
  ].join(";");
}

/**
 * Converts a Redis URI to StackExchange.Redis format for .NET.
 * Input:  redis://localhost:32780
 * Output: localhost:32780
 */
function redisUriToStackExchange(uri: string): string {
  const url = new URL(uri);
  return `${url.hostname}:${url.port}`;
}

/**
 * Converts an AMQP URI to .NET RabbitMQ client format.
 * AMQP URIs are generally supported by the .NET RabbitMQ.Client library,
 * so this is a pass-through.
 */
function formatRabbitUrl(uri: string): string {
  return uri;
}

/**
 * Finds a random available port by binding to port 0.
 */
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("Failed to get port"));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

/**
 * Polls the Geo service health endpoint until it responds.
 */
async function waitForGeoReady(port: number, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const url = `http://localhost:${port}/health`;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Geo .NET service failed to start within ${timeoutMs}ms on port ${port}`);
}

/**
 * Starts the .NET Geo.API as a child process.
 *
 * @returns The gRPC address (host:port) for the Geo service
 */
export async function startGeoService(opts: {
  pgUrl: string;
  redisUrl: string;
  rabbitUrl: string;
  apiKey: string;
}): Promise<string> {
  // Find the Geo.API project relative to the repo root
  const projectDir = resolve(
    import.meta.dirname,
    "../../../../../../backends/dotnet/services/Geo/Geo.API",
  );

  const httpPort = await getAvailablePort();
  const grpcPort = await getAvailablePort();

  geoPort = grpcPort;

  const env: Record<string, string> = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    // Kestrel: separate HTTP/1.1 (health) and HTTP/2 (gRPC) endpoints
    Kestrel__Endpoints__Http1__Url: `http://+:${httpPort}`,
    Kestrel__Endpoints__Http1__Protocols: "Http1",
    Kestrel__Endpoints__Grpc__Url: `http://+:${grpcPort}`,
    Kestrel__Endpoints__Grpc__Protocols: "Http2",
    // Connection strings (Aspire naming with hyphens)
    // .NET Npgsql requires ADO.NET format (Host=...;Port=...;Database=...)
    // not URI format (postgresql://...) that Node.js pg uses.
    "ConnectionStrings__d2-services-geo": pgUriToAdoNet(opts.pgUrl),
    // .NET StackExchange.Redis expects host:port, not redis://host:port
    "ConnectionStrings__d2-redis": redisUriToStackExchange(opts.redisUrl),
    "ConnectionStrings__d2-rabbitmq": formatRabbitUrl(opts.rabbitUrl),
    // API key mapping: allow "user" and "org_contact" context keys
    "GeoAppOptions__ApiKeyMappings__e2e-test-key__0": "user",
    "GeoAppOptions__ApiKeyMappings__e2e-test-key__1": "org_contact",
    // Run EF Core migrations on startup (creates tables in test container)
    AUTO_MIGRATE: "true",
    // Disable OTel in tests
    OTEL_SDK_DISABLED: "true",
  } as Record<string, string>;

  geoProcess = spawn("dotnet", ["run", "--project", projectDir, "--no-build", "--no-launch-profile"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Log stdout/stderr for debugging
  geoProcess.stdout?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[Geo.API] ${msg}`);
  });
  geoProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[Geo.API] ${msg}`);
  });

  geoProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[Geo.API] Process exited with code ${code}`);
    }
  });

  // Wait for the HTTP health endpoint to be ready
  await waitForGeoReady(httpPort);

  return `localhost:${grpcPort}`;
}

/**
 * Stops the .NET Geo.API process.
 */
export async function stopGeoService(): Promise<void> {
  if (!geoProcess) return;

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      geoProcess?.kill("SIGKILL");
      resolve();
    }, 5_000);

    geoProcess!.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    geoProcess!.kill("SIGTERM");
  });
}

/**
 * Returns the gRPC address of the running Geo service.
 */
export function getGeoAddress(): string {
  if (!geoPort) throw new Error("Geo service not started");
  return `localhost:${geoPort}`;
}
