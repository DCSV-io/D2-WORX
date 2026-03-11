import { BaseHandler, type IHandlerContext, validators } from "@d2/handler";
import { D2Result } from "@d2/result";
import { CircuitBreaker, CircuitState } from "@d2/utilities";
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
  private readonly circuitBreaker: CircuitBreaker;

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
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: options.circuitBreakerFailureThreshold,
      cooldownMs: options.circuitBreakerCooldownMs,
      onStateChange: (from, to) => {
        if (to === CircuitState.OPEN) {
          context.logger.warn(
            `Geo gRPC circuit breaker opened after ${options.circuitBreakerFailureThreshold} consecutive failures. ` +
            `Will probe in ${options.circuitBreakerCooldownMs}ms.`,
          );
        } else if (to === CircuitState.CLOSED && from === CircuitState.HALF_OPEN) {
          context.logger.info("Geo gRPC circuit breaker closed — service recovered.");
        }
      },
    });
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

    // Try cache first (null = negative cache sentinel, undefined = miss)
    const cached = this.store.get<WhoIsDTO | null>(cacheKey);
    if (cached !== undefined) {
      return D2Result.ok({ data: { whoIs: cached ?? undefined } });
    }

    // Cache miss — call Geo service (circuit breaker protects against sustained failures)
    let response: FindWhoIsResponse;
    try {
      const request: FindWhoIsRequest = {
        requests: [{ ipAddress: input.ipAddress, fingerprint: input.fingerprint }],
      };
      response = await this.circuitBreaker.execute(() =>
        new Promise<FindWhoIsResponse>((resolve, reject) => {
          this.geoClient.findWhoIs(
            request,
            new Metadata(),
            { deadline: Date.now() + this.options.grpcTimeoutMs },
            (err, res) => {
              if (err) reject(err);
              else resolve(res);
            },
          );
        }),
      );
    } catch {
      // Fail-open: handles gRPC errors AND circuit-open rejections identically.
      // When the circuit is open this returns instantly (no timeout wait).
      // Do not log input.ipAddress directly — it bypasses BaseHandler's redaction.
      if (this.circuitBreaker.state !== CircuitState.OPEN) {
        this.context.logger.warn(`gRPC call to Geo service failed. TraceId: ${this.traceId}`);
      }
      return D2Result.ok({ data: { whoIs: undefined } });
    }

    if (!response.result?.success || response.data.length === 0) {
      // Negative cache: avoid repeated gRPC calls for unknown IPs
      this.store.set(cacheKey, null, this.options.whoIsNegativeCacheExpirationMs);
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
