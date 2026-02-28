import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkHealth, listJobs, upsertJob, deleteJob, type DkronJob } from "@d2/dkron-mgr";
import type { ILogger } from "@d2/logging";

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

const baseUrl = "http://localhost:8888";
let logger: ILogger;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  logger = createSilentLogger();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("checkHealth", () => {
  it("should return true when /v1/leader responds 200 with leader address", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("127.0.0.1:8946", { status: 200 }),
    );

    const result = await checkHealth(baseUrl, logger);

    expect(result).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/v1/leader`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("should return false when /v1/leader responds non-2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 503 }));

    const result = await checkHealth(baseUrl, logger);

    expect(result).toBe(false);
  });

  it("should return false when /v1/leader returns empty body (Raft not ready)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));

    const result = await checkHealth(baseUrl, logger);

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Raft not ready"),
    );
  });

  it("should return false on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await checkHealth(baseUrl, logger);

    expect(result).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      "Dkron health check failed",
      expect.any(Error),
    );
  });
});

describe("listJobs", () => {
  it("should return parsed job array", async () => {
    const jobs: DkronJob[] = [
      {
        name: "test-job",
        displayname: "Test",
        schedule: "0 0 * * * *",
        timezone: "UTC",
        executor: "http",
        executor_config: { method: "POST", url: "http://example.com" },
        concurrency: "forbid",
        retries: 2,
        disabled: false,
        metadata: { managed_by: "d2-dkron-mgr" },
      },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(jobs), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await listJobs(baseUrl, logger);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("test-job");
  });

  it("should return empty array when Dkron responds with null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("null", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await listJobs(baseUrl, logger);

    expect(result).toEqual([]);
  });

  it("should return empty array when Dkron has no jobs", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await listJobs(baseUrl, logger);

    expect(result).toEqual([]);
  });

  it("should throw on non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 }));

    await expect(listJobs(baseUrl, logger)).rejects.toThrow("Dkron GET /v1/jobs returned 500");
  });
});

describe("upsertJob", () => {
  const job: DkronJob = {
    name: "test-job",
    displayname: "Test",
    schedule: "0 0 * * * *",
    timezone: "UTC",
    executor: "http",
    executor_config: { method: "POST", url: "http://example.com" },
    concurrency: "forbid",
    retries: 2,
    disabled: false,
    metadata: { managed_by: "d2-dkron-mgr" },
  };

  it("should POST job payload to /v1/jobs", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(job), { status: 201 }),
    );

    await upsertJob(baseUrl, job, logger);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/v1/jobs`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      }),
    );
  });

  it("should accept 200 as success (update)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(job), { status: 200 }),
    );

    await expect(upsertJob(baseUrl, job, logger)).resolves.toBeUndefined();
  });

  it("should throw on non-2xx response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Bad", { status: 400 }));

    await expect(upsertJob(baseUrl, job, logger)).rejects.toThrow(
      "Dkron POST /v1/jobs (test-job) returned 400",
    );
  });
});

describe("deleteJob", () => {
  it("should DELETE job by name", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));

    await deleteJob(baseUrl, "test-job", logger);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/v1/jobs/test-job`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("should treat 404 as success with warn log", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 404 }));

    await expect(deleteJob(baseUrl, "gone-job", logger)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("gone-job"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("404"));
  });

  it("should throw on non-2xx non-404 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));

    await expect(deleteJob(baseUrl, "test-job", logger)).rejects.toThrow(
      "Dkron DELETE /v1/jobs/test-job returned 500",
    );
  });

  it("should URL-encode job names with special characters", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("", { status: 200 }));

    await deleteJob(baseUrl, "job/with spaces", logger);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${baseUrl}/v1/jobs/job%2Fwith%20spaces`,
      expect.anything(),
    );
  });
});
