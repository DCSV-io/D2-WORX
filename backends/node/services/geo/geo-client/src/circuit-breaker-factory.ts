import { CircuitBreaker, CircuitState } from "@d2/utilities";
import type { ILogger } from "@d2/logging";
import type { GeoClientOptions } from "./geo-client-options.js";

/**
 * Creates a singleton-grade CircuitBreaker configured for Geo gRPC calls.
 * Logs state transitions via the provided logger.
 *
 * Mirrors the .NET `AddGeoCircuitBreaker()` extension method.
 */
export function createGeoCircuitBreaker(
  options: GeoClientOptions,
  logger: ILogger,
): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: options.circuitBreakerFailureThreshold,
    cooldownMs: options.circuitBreakerCooldownMs,
    onStateChange: (from, to) => {
      if (to === CircuitState.OPEN) {
        logger.warn(
          `Geo gRPC circuit breaker opened after ${options.circuitBreakerFailureThreshold} consecutive failures. ` +
            `Will probe in ${options.circuitBreakerCooldownMs}ms.`,
        );
      } else if (to === CircuitState.CLOSED && from === CircuitState.HALF_OPEN) {
        logger.info("Geo gRPC circuit breaker closed — service recovered.");
      }
    },
  });
}
