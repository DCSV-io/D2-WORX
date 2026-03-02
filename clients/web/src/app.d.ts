// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { RequestEnrichment } from "@d2/interfaces";

declare global {
  namespace App {
    interface Error {
      message: string;
      traceId?: string;
    }

    interface Locals {
      /** Populated by request enrichment middleware (Step 2.5) */
      requestInfo?: RequestEnrichment.IRequestInfo;
      /** Populated by auth hook (Step 5) */
      session?: unknown;
      /** Populated by auth hook (Step 5) */
      user?: unknown;
    }

    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
