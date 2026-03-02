// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Error {
      message: string;
      traceId?: string;
    }

    interface Locals {
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
