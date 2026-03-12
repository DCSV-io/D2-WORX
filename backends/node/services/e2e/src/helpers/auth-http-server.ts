import { serve } from "@hono/node-server";
import type { Hono } from "hono";

export interface AuthHttpServer {
  /** Base URL including port, e.g. "http://127.0.0.1:54321". */
  baseUrl: string;
  /** Ephemeral port the server is listening on. */
  port: number;
  /** Stops the HTTP server. */
  close: () => void;
}

/**
 * Wraps a Hono app in a real HTTP server on an ephemeral port.
 * Used by BFF-client integration tests to call the Auth service over HTTP.
 *
 * @param app The Hono application instance from createApp().
 * @returns An object with the base URL and a close function.
 */
export function startAuthHttpServer(app: Hono): Promise<AuthHttpServer> {
  return new Promise<AuthHttpServer>((resolve) => {
    const server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      const port = info.port;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({
        baseUrl,
        port,
        close: () => server.close(),
      });
    });
  });
}
