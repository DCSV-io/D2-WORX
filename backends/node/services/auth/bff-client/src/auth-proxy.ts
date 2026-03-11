/**
 * Auth proxy — forwards auth requests from SvelteKit to the Auth service.
 *
 * Used by the catch-all route at /api/auth/[...path] to proxy all BetterAuth
 * API calls through SvelteKit. This ensures session cookies (httpOnly, sameSite)
 * work correctly and all auth traffic flows through the Auth service's full
 * security middleware pipeline (rate limiting, fingerprint binding, etc.).
 */
import type { RequestEvent } from "@sveltejs/kit";
import type { ILogger } from "@d2/logging";
import type { AuthBffConfig } from "./types.js";

/** Headers to forward from the incoming request to the Auth service. */
const FORWARDED_HEADERS = [
  "authorization",
  "cookie",
  "content-type",
  "x-client-fingerprint",
  "x-forwarded-for",
  "user-agent",
  "accept",
  "accept-language",
  "origin",
  "referer",
] as const;

const DEFAULT_TIMEOUT = 10000;

export class AuthProxy {
  private readonly config: AuthBffConfig;
  private readonly logger: ILogger;

  constructor(config: AuthBffConfig, logger: ILogger) {
    // Normalize: strip trailing slash to prevent double-slash in target URLs
    this.config = {
      ...config,
      authServiceUrl: config.authServiceUrl.replace(/\/+$/, ""),
    };
    this.logger = logger;
  }

  /**
   * Proxies the incoming SvelteKit request to the Auth service.
   * Preserves set-cookie headers in the response for session management.
   */
  async proxyRequest(event: RequestEvent): Promise<Response> {
    const { request, url } = event;

    // Build target URL: /api/auth/sign-in → http://auth-service:5100/api/auth/sign-in
    const targetPath = url.pathname + url.search;
    const targetUrl = `${this.config.authServiceUrl}${targetPath}`;

    // Forward allowed headers
    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value) {
        headers.set(name, value);
      }
    }

    // Identify as trusted service for S2S bypass (rate limiting, fingerprint validation)
    if (this.config.apiKey) {
      headers.set("x-api-key", this.config.apiKey);
    }

    // Forward client IP if available from request enrichment
    const locals = event.locals as Record<string, unknown>;
    const requestContext = locals.requestContext as { clientIp?: string } | undefined;
    const clientIp =
      requestContext?.clientIp ??
      request.headers.get("x-forwarded-for");
    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
    }

    const timeout = this.config.timeout ?? DEFAULT_TIMEOUT;

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: hasBody(request.method) ? request.body : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(timeout),
        // @ts-expect-error -- Node.js fetch supports duplex for streaming bodies
        duplex: hasBody(request.method) ? "half" : undefined,
      });

      // Build response, preserving set-cookie headers
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        // Preserve all headers including multiple set-cookie entries
        responseHeaders.append(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      this.logger.warn("Auth proxy request failed", {
        target: targetUrl,
        error: error instanceof Error ? error.message : String(error),
      });

      return new Response(
        JSON.stringify({
          success: false,
          messages: ["Auth service unavailable. Please try again."],
          statusCode: 503,
          errorCode: "AUTH_UNAVAILABLE",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }
}

function hasBody(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}
