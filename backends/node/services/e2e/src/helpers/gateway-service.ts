import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import net from "node:net";

let gatewayProcess: ChildProcess | undefined;
let gatewayPort: number | undefined;

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
 * Polls the Gateway health endpoint until it responds.
 */
async function waitForGatewayReady(port: number, timeoutMs = 60_000): Promise<void> {
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

  throw new Error(`Gateway failed to start within ${timeoutMs}ms on port ${port}`);
}

/**
 * Starts the .NET REST Gateway as a child process.
 *
 * @returns The Gateway HTTP URL (http://localhost:{port})
 */
export async function startGateway(opts: {
  redisUrl: string;
  geoGrpcAddress: string;
  serviceKey: string;
  geoApiKey: string;
}): Promise<string> {
  const projectDir = resolve(
    import.meta.dirname,
    "../../../../../../backends/dotnet/gateways/REST",
  );

  const httpPort = await getAvailablePort();
  gatewayPort = httpPort;

  const env: Record<string, string> = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    // Single HTTP endpoint (Gateway doesn't need separate gRPC port)
    ASPNETCORE_URLS: `http://+:${httpPort}`,
    // Redis connection
    "ConnectionStrings__d2-redis": redisUriToStackExchange(opts.redisUrl),
    // Geo gRPC address (the only service we actually call)
    "services__d2-geo__http__0": `http://${opts.geoGrpcAddress}`,
    // Auth + Comms gRPC addresses (required by config validation, but not called)
    "services__d2-auth__auth-grpc__0": "http://localhost:1",
    "services__d2-comms__comms-grpc__0": "http://localhost:1",
    // Auth HTTP address (for health endpoint fan-out — not critical for jobs)
    "services__d2-auth__auth-http__0": "http://localhost:1",
    // Service key config: allow Dkron's X-Api-Key to pass
    "GATEWAY_SERVICEKEY__ValidKeys__0": opts.serviceKey,
    // gRPC API keys (sent as call credentials to downstream services)
    GATEWAY_GEO_GRPC_API_KEY: opts.geoApiKey,
    // Auth + Comms keys required by startup validation but not called in Geo-only tests
    GATEWAY_AUTH_GRPC_API_KEY: "e2e-dummy-auth-key",
    GATEWAY_COMMS_GRPC_API_KEY: "e2e-dummy-comms-key",
    // JWT config (required by service registration, but service-key endpoints skip JWT)
    GATEWAY_AUTH__AuthServiceBaseUrl: "http://localhost:1",
    GATEWAY_AUTH__Issuer: "e2e-test",
    GATEWAY_AUTH__Audience: "e2e-test",
    // Disable OTel in tests
    OTEL_SDK_DISABLED: "true",
  } as Record<string, string>;

  gatewayProcess = spawn(
    "dotnet",
    ["run", "--project", projectDir, "--no-build", "--no-launch-profile"],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  // Log stdout/stderr for debugging
  gatewayProcess.stdout?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[Gateway] ${msg}`);
  });
  gatewayProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[Gateway] ${msg}`);
  });

  gatewayProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[Gateway] Process exited with code ${code}`);
    }
  });

  // Wait for the health endpoint
  await waitForGatewayReady(httpPort);

  return `http://localhost:${httpPort}`;
}

/**
 * Stops the .NET Gateway process.
 */
export async function stopGateway(): Promise<void> {
  if (!gatewayProcess) return;

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      gatewayProcess?.kill("SIGKILL");
      resolve();
    }, 5_000);

    gatewayProcess!.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    gatewayProcess!.kill("SIGTERM");
  });
}

/**
 * Returns the HTTP URL of the running Gateway.
 */
export function getGatewayUrl(): string {
  if (!gatewayPort) throw new Error("Gateway not started");
  return `http://localhost:${gatewayPort}`;
}
