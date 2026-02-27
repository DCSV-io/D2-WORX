import { createServiceKey } from "@d2/di";
import type { IHandlerContext } from "./i-handler-context.js";
import type { IRequestContext } from "./i-request-context.js";

/** DI key for the per-request context (scoped). */
export const IRequestContextKey = createServiceKey<IRequestContext>("IRequestContext");

/** DI key for the handler context (scoped). */
export const IHandlerContextKey = createServiceKey<IHandlerContext>("IHandlerContext");
