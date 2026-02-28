import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import pg from "pg";
import crypto from "node:crypto";
import { listJobs, upsertJob, type DkronJob } from "@d2/dkron-mgr";
import type { ILogger } from "@d2/logging";
import { vi } from "vitest";
import { startContainers, stopContainers, getGeoPgUrl, getRedisUrl, getRabbitUrl } from "../helpers/containers.js";
import { startGeoService, stopGeoService, getGeoAddress } from "../helpers/geo-dotnet-service.js";
import { startGateway, stopGateway, getGatewayUrl } from "../helpers/gateway-service.js";

function createSilentLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

/**
 * Full-chain E2E test: Dkron -> Gateway -> Geo gRPC -> PostgreSQL
 *
 * Validates the complete production pipeline for scheduled jobs:
 * 1. dkron-mgr starts, connects to Dkron, reconciles 8 jobs
 * 2. Dkron HTTP executor fires POST to the Gateway with X-Api-Key header
 * 3. Gateway validates service key, proxies to Geo gRPC PurgeStaleWhoIs RPC
 * 4. Geo handler acquires distributed lock (Redis), deletes stale WhoIs records (PG)
 * 5. Stale WhoIs records removed from DB, fresh records preserved
 */
describe("E2E: Dkron -> Gateway -> Geo full job chain", () => {
  let dkronContainer: StartedTestContainer;
  let dkronUrl: string;
  let mgrProcess: ChildProcess | undefined;
  let geoPool: pg.Pool;
  const logger = createSilentLogger();
  const mgrStdout: string[] = [];

  const serviceKey = "e2e-test-service-key";
  const geoApiKey = "e2e-test-key";

  // Deterministic hash IDs (SHA-256 hex, 64 chars) for test WhoIs records.
  const staleHash1 = crypto.createHash("sha256").update("stale-whois-1").digest("hex");
  const staleHash2 = crypto.createHash("sha256").update("stale-whois-2").digest("hex");
  const freshHash = crypto.createHash("sha256").update("fresh-whois-1").digest("hex");

  beforeAll(async () => {
    // 1. Start shared containers (PG + Redis + RabbitMQ) + Dkron in parallel
    const [, dkronC] = await Promise.all([
      startContainers(),
      new GenericContainer("dkron/dkron:4.0.9")
        .withExposedPorts(8080)
        .withCommand(["agent", "--server", "--bootstrap-expect=1"])
        .withWaitStrategy(
          Wait.forAll([
            Wait.forHttp("/health", 8080).forStatusCode(200),
            Wait.forHttp("/v1/leader", 8080).forStatusCode(200),
          ]),
        )
        .start(),
    ]);

    dkronContainer = dkronC;
    dkronUrl = `http://${dkronContainer.getHost()}:${dkronContainer.getMappedPort(8080)}`;

    // 2. Start .NET Geo service
    await startGeoService({
      pgUrl: getGeoPgUrl(),
      redisUrl: getRedisUrl(),
      rabbitUrl: getRabbitUrl(),
      apiKey: geoApiKey,
    });

    // 3. Start .NET Gateway
    await startGateway({
      redisUrl: getRedisUrl(),
      geoGrpcAddress: getGeoAddress(),
      serviceKey,
      geoApiKey,
    });

    const gatewayUrl = getGatewayUrl();

    // 4. Spawn dkron-mgr and wait for reconciliation.
    // Dkron runs in Docker but calls the Gateway on the host.
    // Use host.docker.internal so the Dkron container can reach the host-bound Gateway.
    const gatewayPort = new URL(gatewayUrl).port;
    const dkronMgrDir = resolve(
      import.meta.dirname,
      "../../../../../../backends/node/services/dkron-mgr",
    );
    const mainTs = resolve(dkronMgrDir, "src", "main.ts");

    mgrProcess = spawn(
      process.execPath,
      ["--import", "tsx", mainTs],
      {
        cwd: dkronMgrDir,
        env: {
          ...process.env,
          DKRON_MGR__DKRON_URL: dkronUrl,
          DKRON_MGR__GATEWAY_URL: `http://host.docker.internal:${gatewayPort}`,
          DKRON_MGR__SERVICE_KEY: serviceKey,
          DKRON_MGR__RECONCILE_INTERVAL_MS: "600000",
          OTEL_SDK_DISABLED: "true",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    mgrProcess.stdout!.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n")) {
        const trimmed = line.trim();
        if (trimmed) mgrStdout.push(trimmed);
      }
    });
    mgrProcess.stderr!.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n")) {
        const trimmed = line.trim();
        if (trimmed) mgrStdout.push(trimmed);
      }
    });

    // Wait for dkron-mgr to complete initial reconciliation
    await waitForOutput(mgrStdout, "Reconciliation complete", 30_000);

    // 5. Override geo-purge-stale-whois schedule to fire every 5 seconds.
    // Dkron 4.0.9 has no manual trigger API, so we use a fast cron.
    const jobs = await listJobs(dkronUrl, logger);
    const purgeJob = jobs.find((j) => j.name === "geo-purge-stale-whois");
    expect(purgeJob, "geo-purge-stale-whois should exist after reconciliation").toBeDefined();

    await upsertJob(
      dkronUrl,
      { ...purgeJob!, schedule: "@every 5s" } as DkronJob,
      logger,
    );

    // 6. Seed test data directly in PG.
    geoPool = new pg.Pool({ connectionString: getGeoPgUrl() });

    await geoPool.query(
      `INSERT INTO who_is (hash_id, ip_address, year, month, fingerprint)
       VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15)
       ON CONFLICT (hash_id) DO NOTHING`,
      [
        // Stale record 1: Year 2024, Month 1 — well before any cutoff
        staleHash1, "10.0.0.1", 2024, 1, "fp-stale-1",
        // Stale record 2: Year 2024, Month 6
        staleHash2, "10.0.0.2", 2024, 6, "fp-stale-2",
        // Fresh record: Year 2099, Month 1 — always newer than cutoff
        freshHash, "10.0.0.3", 2099, 1, "fp-fresh-1",
      ],
    );
  }, 180_000);

  afterAll(async () => {
    // Kill dkron-mgr
    if (mgrProcess && mgrProcess.exitCode === null) {
      mgrProcess.kill();
      await new Promise<void>((r) => {
        mgrProcess!.on("exit", () => r());
        setTimeout(r, 5_000);
      });
    }

    // Stop Gateway, Geo, Dkron
    await stopGateway();
    await stopGeoService();
    await dkronContainer?.stop().catch(() => {});

    // Close pool and shared containers
    await geoPool?.end().catch(() => {});
    await stopContainers();
  });

  it("fires geo-purge-stale-whois and deletes stale WhoIs records", async () => {
    // Poll Dkron until the job has at least one successful execution
    await pollForJobSuccess("geo-purge-stale-whois", 45_000);

    // Verify stale records were deleted
    const staleResult = await geoPool.query(
      "SELECT hash_id FROM who_is WHERE hash_id = ANY($1::text[])",
      [[staleHash1, staleHash2]],
    );
    expect(staleResult.rows).toHaveLength(0);

    // Verify fresh record preserved
    const freshResult = await geoPool.query(
      "SELECT hash_id FROM who_is WHERE hash_id = $1",
      [freshHash],
    );
    expect(freshResult.rows).toHaveLength(1);

    // Verify Dkron reports no errors for this job
    const jobRes = await fetch(`${dkronUrl}/v1/jobs/geo-purge-stale-whois`);
    const jobData = (await jobRes.json()) as { success_count?: number; error_count?: number };
    expect(jobData.error_count ?? 0).toBe(0);
    expect(jobData.success_count).toBeGreaterThan(0);
  }, 60_000);

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Poll Dkron job status until success_count > 0. */
  async function pollForJobSuccess(jobName: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${dkronUrl}/v1/jobs/${jobName}`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (res.ok) {
          const job = (await res.json()) as { success_count?: number };
          if ((job.success_count ?? 0) > 0) return;
        }
      } catch {
        // Dkron may not be ready yet
      }
      await new Promise((r) => setTimeout(r, 2_000));
    }

    // Dump mgrStdout for debugging on failure
    console.error("[dkron-mgr stdout]", mgrStdout.join("\n"));
    throw new Error(`Job "${jobName}" did not succeed within ${timeoutMs}ms`);
  }
});

/** Poll stdout lines for a substring, rejecting on timeout. */
function waitForOutput(lines: string[], needle: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (lines.some((l) => l.includes(needle))) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve();
      }
    }, 200);

    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(
        new Error(
          `Timed out waiting for "${needle}" after ${timeoutMs}ms.\nCaptured output:\n${lines.join("\n")}`,
        ),
      );
    }, timeoutMs);
  });
}
