import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryCacheStore } from "@d2/cache-memory";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";
import { GeoRefData as GeoRefDataCodec } from "@d2/protos";
import type { GeoRefData, GeoServiceClient } from "@d2/protos";
import { ErrorCodes, HttpStatusCode } from "@d2/result";
import {
  SetInMem,
  GetFromMem,
  SetOnDisk,
  GetFromDisk,
  SetInDist,
  GeoRefDataSerializer,
  GetFromDist,
  ReqUpdate,
} from "@d2/geo-client";
import type { GeoClientOptions } from "@d2/geo-client";

function createTestContext(): IHandlerContext {
  const request: IRequestContext = {
    traceId: "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}

function createTestGeoRefData(): GeoRefData {
  return GeoRefDataCodec.fromPartial({
    version: "1.0.0",
    countries: {},
    subdivisions: {},
    currencies: {},
    languages: {},
    locales: {},
    geopoliticalEntities: {},
  });
}

describe("Geo-client reference data handlers", () => {
  describe("SetInMem / GetFromMem", () => {
    let store: MemoryCacheStore;

    beforeEach(() => {
      store = new MemoryCacheStore();
    });

    it("should set and get GeoRefData from memory", async () => {
      const data = createTestGeoRefData();
      const setHandler = new SetInMem(store, createTestContext());
      const setR = await setHandler.handleAsync({ data });
      expect(setR).toBeSuccess();

      const getHandler = new GetFromMem(store, createTestContext());
      const getR = await getHandler.handleAsync({});
      expect(getR).toBeSuccess();
      expect(getR.data?.data.version).toBe("1.0.0");
    });

    it("should return NotFound when memory cache is empty", async () => {
      const getHandler = new GetFromMem(store, createTestContext());
      const getR = await getHandler.handleAsync({});
      expect(getR).toBeFailure();
      expect(getR.errorCode).toBe(ErrorCodes.NOT_FOUND);
    });
  });

  describe("SetOnDisk / GetFromDisk", () => {
    let tempDir: string;
    let options: GeoClientOptions;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "d2-geo-test-"));
      options = {
        whoIsCacheExpirationMs: 28_800_000,
        whoIsCacheMaxEntries: 10_000,
        dataDir: tempDir,
      };
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("should write and read GeoRefData from disk", async () => {
      const data = createTestGeoRefData();
      const setHandler = new SetOnDisk(options, createTestContext());
      const setR = await setHandler.handleAsync({ data });
      expect(setR).toBeSuccess();

      const getHandler = new GetFromDisk(options, createTestContext());
      const getR = await getHandler.handleAsync({});
      expect(getR).toBeSuccess();
      expect(getR.data?.data.version).toBe("1.0.0");
    });

    it("should return NotFound when file does not exist", async () => {
      const getHandler = new GetFromDisk(options, createTestContext());
      const getR = await getHandler.handleAsync({});
      expect(getR).toBeFailure();
      expect(getR.errorCode).toBe(ErrorCodes.NOT_FOUND);
    });

    it("should return COULD_NOT_BE_DESERIALIZED for corrupted data", async () => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(tempDir, "georefdata.bin"), "not-valid-protobuf");

      const getHandler = new GetFromDisk(options, createTestContext());
      const getR = await getHandler.handleAsync({});
      expect(getR).toBeFailure();
      expect(getR.errorCode).toBe(ErrorCodes.COULD_NOT_BE_DESERIALIZED);
    });

    it("should preserve proto data through encode/decode round-trip", async () => {
      const data = GeoRefDataCodec.fromPartial({
        version: "2.5.0",
        countries: { US: { iso31661Alpha2Code: "US", displayName: "United States" } },
      });

      const setHandler = new SetOnDisk(options, createTestContext());
      await setHandler.handleAsync({ data });

      const getHandler = new GetFromDisk(options, createTestContext());
      const getR = await getHandler.handleAsync({});
      expect(getR).toBeSuccess();
      expect(getR.data?.data.version).toBe("2.5.0");
      expect(getR.data?.data.countries["US"]?.displayName).toBe("United States");
    });
  });

  describe("SetInDist / GetFromDist", () => {
    it("should delegate to distributed cache handler for set", async () => {
      const mockDistSet = {
        handleAsync: vi.fn().mockResolvedValue({
          success: true,
          failed: false,
          data: {},
          messages: [],
          inputErrors: [],
          statusCode: 200,
          checkSuccess: () => ({}),
          checkFailure: () => undefined,
        }),
      };

      const handler = new SetInDist(mockDistSet as never, createTestContext());
      const data = createTestGeoRefData();
      const result = await handler.handleAsync({ data });

      expect(result).toBeSuccess();
      expect(mockDistSet.handleAsync).toHaveBeenCalledWith(
        expect.objectContaining({ key: "d2:geo:refdata" }),
      );
    });

    it("should delegate to distributed cache handler for get", async () => {
      const data = createTestGeoRefData();
      const mockDistGet = {
        handleAsync: vi.fn().mockResolvedValue({
          success: true,
          failed: false,
          data: { value: data },
          messages: [],
          inputErrors: [],
          statusCode: 200,
          checkSuccess: () => ({ value: data }),
          checkFailure: () => undefined,
        }),
      };

      const handler = new GetFromDist(mockDistGet as never, createTestContext());
      const result = await handler.handleAsync({});

      expect(result).toBeSuccess();
      expect(result.data?.data.version).toBe("1.0.0");
    });

    it("should return NotFound when distributed cache misses", async () => {
      const mockDistGet = {
        handleAsync: vi.fn().mockResolvedValue({
          success: false,
          failed: true,
          data: undefined,
          messages: ["Resource not found."],
          inputErrors: [],
          statusCode: 404,
          errorCode: "NOT_FOUND",
          checkSuccess: () => undefined,
          checkFailure: () => undefined,
        }),
      };

      const handler = new GetFromDist(mockDistGet as never, createTestContext());
      const result = await handler.handleAsync({});

      expect(result).toBeFailure();
      expect(result.errorCode).toBe(ErrorCodes.NOT_FOUND);
    });
  });

  describe("GeoRefDataSerializer", () => {
    it("should serialize and deserialize GeoRefData via protobuf", () => {
      const serializer = new GeoRefDataSerializer();
      const data = createTestGeoRefData();

      const buffer = serializer.serialize(data);
      expect(buffer).toBeInstanceOf(Buffer);

      const decoded = serializer.deserialize(buffer);
      expect(decoded.version).toBe("1.0.0");
    });
  });

  describe("ReqUpdate", () => {
    it("should return version on success", async () => {
      const response = {
        result: {
          success: true,
          statusCode: 200,
          messages: [],
          inputErrors: [],
          errorCode: "",
          traceId: "",
        },
        data: { version: "3.0.0" },
      };
      const mockGeoClient = {
        requestReferenceDataUpdate: vi.fn(
          (_req: unknown, cb: (err: Error | null, res: typeof response) => void) => {
            cb(null, response);
          },
        ),
      } as unknown as GeoServiceClient;

      const handler = new ReqUpdate(mockGeoClient, createTestContext());
      const result = await handler.handleAsync({});

      expect(result).toBeSuccess();
      expect(result.data?.version).toBe("3.0.0");
    });

    it("should return failure on gRPC error", async () => {
      const error = Object.assign(new Error("Unavailable"), { code: 14 });
      const mockGeoClient = {
        requestReferenceDataUpdate: vi.fn(
          (_req: unknown, cb: (err: Error | null, res: never) => void) => {
            cb(error, undefined as never);
          },
        ),
      } as unknown as GeoServiceClient;

      const handler = new ReqUpdate(mockGeoClient, createTestContext());
      const result = await handler.handleAsync({});

      expect(result).toBeFailure();
      expect(result.statusCode).toBe(HttpStatusCode.ServiceUnavailable);
    });
  });
});
