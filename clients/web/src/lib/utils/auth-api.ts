/**
 * Client-side utility for calling custom auth service endpoints.
 *
 * Custom auth endpoints (e.g. check-email) return D2Result responses
 * and go through SvelteKit's /api/auth/* proxy to the Auth service.
 *
 * Uses the same timeout / error-handling / D2Result-parsing patterns
 * as gateway-client.ts, but targets the auth proxy (relative URLs)
 * instead of the .NET gateway (PUBLIC_GATEWAY_URL).
 *
 * For BetterAuth operations (signUp, signIn, etc.), use authClient instead.
 */
import { D2Result, type HttpStatusCode } from "@d2/result";
import { parseGatewayResponse, networkErrorResult } from "./gateway-response.js";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface AuthApiCallOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  timeout?: number;
}

/**
 * Call a custom auth service endpoint that returns D2Result.
 *
 * Requests are sent to the SvelteKit auth proxy at `/api/auth/*`,
 * which forwards them to the Auth service with full cookie/header
 * preservation through the security middleware pipeline.
 *
 * @param path - Auth endpoint path (e.g. "/api/auth/check-email?email=...")
 * @param options - Optional request configuration
 */
export async function authApiCall<TData = void>(
  path: string,
  options?: AuthApiCallOptions,
): Promise<D2Result<TData>> {
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS;

  try {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = options?.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal;

    const headers = new Headers();
    if (options?.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
      method: options?.method ?? "GET",
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "include",
      signal,
    });

    return parseGatewayResponse<TData>(response);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return D2Result.fail<TData>({
        messages: ["Request was aborted."],
        statusCode: 408 as HttpStatusCode,
      });
    }

    if (error instanceof DOMException && error.name === "TimeoutError") {
      return D2Result.fail<TData>({
        messages: [`Request timed out after ${timeoutMs}ms.`],
        statusCode: 408 as HttpStatusCode,
      });
    }

    return networkErrorResult<TData>(error);
  }
}
