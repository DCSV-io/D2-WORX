import { AsyncLocalStorage } from "node:async_hooks";
import type { ILogger } from "@d2/logging";
import type { IRequestContext } from "./i-request-context.js";

/**
 * Ambient per-request context storages.
 *
 * These provide automatic per-request context to ALL handlers — including
 * pre-auth singletons — without manual wiring. Mirrors .NET's HttpContext
 * scoping where DI automatically resolves per-request context.
 *
 * Middleware sets the storage via `.run()`, and HandlerContext reads from
 * it automatically. Downstream middleware (e.g., auth scope) can upgrade
 * the stored value via `.enterWith()`.
 */
export const requestContextStorage = new AsyncLocalStorage<IRequestContext>();
export const requestLoggerStorage = new AsyncLocalStorage<ILogger>();
