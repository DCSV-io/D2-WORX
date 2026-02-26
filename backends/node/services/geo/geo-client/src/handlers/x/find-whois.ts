import { BaseHandler, type IHandlerContext, validators } from "@d2/handler";
import { D2Result } from "@d2/result";
import type { WhoIsDTO, FindWhoIsRequest, FindWhoIsResponse, GeoServiceClient } from "@d2/protos";
import type { MemoryCacheStore } from "@d2/cache-memory";
import { Metadata } from "@grpc/grpc-js";
import { z } from "zod";
import type { GeoClientOptions } from "../../geo-client-options.js";
import { GEO_CACHE_KEYS } from "../../cache-keys.js";
import { Complex } from "../../interfaces/index.js";

type Input = Complex.FindWhoIsInput;
type Output = Complex.FindWhoIsOutput;

/**
 * Handler for finding WhoIs data by IP address and fingerprint.
 * Checks local LRU memory cache first, falls back to Geo service gRPC.
 * Fail-open: never returns error results, always Ok with nullable WhoIsDTO.
 *
 * Mirrors D2.Geo.Client.CQRS.Handlers.X.FindWhoIs in .NET.
 */
export class FindWhoIs extends BaseHandler<Input, Output> implements Complex.IFindWhoIsHandler {
  override get redaction() {
    return Complex.FIND_WHOIS_REDACTION;
  }

  private readonly store: MemoryCacheStore;
  private readonly geoClient: GeoServiceClient;
  private readonly options: GeoClientOptions;

  constructor(
    store: MemoryCacheStore,
    geoClient: GeoServiceClient,
    options: GeoClientOptions,
    context: IHandlerContext,
  ) {
    super(context);
    this.store = store;
    this.geoClient = geoClient;
    this.options = options;
  }

  private static readonly findWhoIsSchema = z.object({
    ipAddress: validators.zodIpAddress,
    fingerprint: z.string().min(1, "Fingerprint must not be empty"),
  }) as z.ZodType<Input>;

  protected async executeAsync(input: Input): Promise<D2Result<Output | undefined>> {
    // Validate input.
    const validation = this.validateInput(FindWhoIs.findWhoIsSchema, input);
    if (validation.failed) {
      return D2Result.bubbleFail(validation);
    }

    const cacheKey = GEO_CACHE_KEYS.whois(input.ipAddress, input.fingerprint);

    // Try cache first
    const cached = this.store.get<WhoIsDTO>(cacheKey);
    if (cached !== undefined) {
      return D2Result.ok({ data: { whoIs: cached } });
    }

    // Cache miss — call Geo service
    let response: FindWhoIsResponse;
    try {
      const request: FindWhoIsRequest = {
        requests: [{ ipAddress: input.ipAddress, fingerprint: input.fingerprint }],
      };
      response = await new Promise<FindWhoIsResponse>((resolve, reject) => {
        this.geoClient.findWhoIs(
          request,
          new Metadata(),
          { deadline: Date.now() + this.options.grpcTimeoutMs },
          (err, res) => {
            if (err) reject(err);
            else resolve(res);
          },
        );
      });
    } catch {
      // Fail-open: log warning and return undefined.
      // Do not log input.ipAddress directly — it bypasses BaseHandler's redaction.
      this.context.logger.warn(`gRPC call to Geo service failed. TraceId: ${this.traceId}`);
      return D2Result.ok({ data: { whoIs: undefined } });
    }

    if (!response.result?.success || response.data.length === 0) {
      return D2Result.ok({ data: { whoIs: undefined } });
    }

    const whoIs = response.data[0]?.whois;

    // Cache the result
    if (whoIs !== undefined) {
      this.store.set(cacheKey, whoIs, this.options.whoIsCacheExpirationMs);
    }

    return D2Result.ok({ data: { whoIs } });
  }
}

export type { FindWhoIsInput, FindWhoIsOutput } from "../../interfaces/x/find-whois.js";
