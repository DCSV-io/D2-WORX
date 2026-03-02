# SvelteKit Web Client — Implementation Plan

Living document tracking the iterative build-out of the D2-WORX web client.

**Branch:** `feat/client-web`
**Strategy report:** [`SVELTEKIT_STRATEGY.md`](./SVELTEKIT_STRATEGY.md)
**Started:** 2026-03-01

---

## Progress Tracker

| Step | Name                                | Status      | Notes |
| ---- | ----------------------------------- | ----------- | ----- |
| 0    | Document Implementation Plan        | Complete    |       |
| 1    | Error Handling Foundation + Types   | Complete    | Fixed pre-existing Vitest 4 config (`environment: "browser"` → `browser.enabled`), installed Playwright Chromium, updated deprecated `@vitest/browser/context` imports |
| 2    | shadcn-svelte + Theme + Tokens      | Complete    | Zinc OKLCH theme, Gabarito font, mode-watcher 3-way toggle, Sonner toasts. Added `optimizeDeps.include` for stable browser tests. Used `@lucide/svelte` (rebranded from `lucide-svelte`) |
| 2.5  | Server-Side Middleware              | Complete    | Request enrichment, rate limiting, idempotency. Direct SvelteKit→Geo gRPC for FindWhoIs. Graceful degradation when Redis/Geo unavailable |
| 3    | Design System Sprint (Kitchen Sink) | Complete    | Live theme editor at `/design` with 5 OKLCH presets, 27 shadcn-svelte components, 10 showcase sections. Client-only (`ssr: false`), theme overrides cleaned up on navigation away |
| 4    | Route Groups + Layout System        | Pending     |       |
| 5    | @d2/auth-bff-client + Auth Proxy    | Pending     |       |
| 6    | API Client Layer (Gateway)          | Pending     |       |
| 7    | Forms Architecture (Superforms)     | Pending     |       |
| 8    | Auth Pages (Sign-In, Sign-Up, etc.) | Pending     |       |
| 9    | Client Telemetry (Grafana Faro)     | Pending     |       |
| 10   | Onboarding Flow                     | Pending     |       |
| 11   | App Shell (Sidebar, Header, Org)    | Pending     |       |
| 12   | SignalR Abstraction Layer           | Pending     |       |

---

## Architectural Decisions (Pre-Resolved)

| Decision              | Choice                                                                |
| --------------------- | --------------------------------------------------------------------- |
| UI Components         | shadcn-svelte (Bits UI headless primitives)                           |
| Forms                 | sveltekit-superforms + formsnap (Zod, progressive enhancement)        |
| Toasts                | svelte-sonner                                                         |
| Icons                 | Lucide (tree-shakeable, shadcn default)                               |
| Font                  | Gabarito (single family, weight variations)                           |
| Theme                 | Dark + Light + System (mode-watcher)                                  |
| Phone Input           | intl-tel-input (Svelte 5 wrapper)                                     |
| Address Autocomplete  | Radar as Geo service infra — frontend calls gateway, gets LocationDTOs |
| Real-Time             | SignalR Option A — browser direct to .NET gateway, SvelteKit stateless |
| Client Telemetry      | Grafana Faro (errors->Loki, traces->Tempo, Web Vitals->Mimir)         |
| Component Testing     | vitest-browser-svelte (real Chromium)                                 |
| E2E Testing           | Playwright + axe-core/playwright (a11y)                               |
| Design Approach       | Design system sprint — kitchen sink page for visual decisions          |

---

## Step Details

### Step 0: Document Implementation Plan

**Goal:** Create this file.

**Status:** Complete

---

### Step 1: Error Handling Foundation + App Types

**Goal:** Error boundaries and type safety before anything else.

**Files:**

| File                                       | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `src/app.d.ts`                             | `App.Error` (message, traceId), `App.Locals` (stubs) |
| `src/hooks.client.ts`                      | Client-side `handleError` + POST to `/api/client-error` |
| `src/routes/+error.svelte`                 | User-facing error page                               |
| `src/error.html`                           | Catastrophic fallback (static HTML)                  |
| `src/routes/api/client-error/+server.ts`   | Receives client errors, logs via OTel                |
| `src/hooks.server.ts`                      | Add `handleError` export                             |

**Tests:** Server test for client-error endpoint, component test for error page, E2E for 404.

---

### Step 2: shadcn-svelte + Theme + Design Tokens

**Goal:** Install component library and configure visual foundation.

**Packages:** `bits-ui`, `lucide-svelte`, `svelte-sonner`, `mode-watcher`, `@internationalized/date`

**Actions:** `npx shadcn-svelte@latest init`, add foundational components (button, card, separator, badge, alert, sonner, tooltip, toggle).

**Files:** `src/app.css` (shadcn theme), `src/app.html` (Gabarito font), `src/routes/+layout.svelte` (Toaster, ModeWatcher), `src/lib/components/theme-toggle.svelte`.

---

### Step 2.5: Server-Side Middleware

**Goal:** Request enrichment, rate limiting, and idempotency on the SvelteKit server — same protections as Auth service (Hono).

**New communication path:** SvelteKit → Geo gRPC (direct, for FindWhoIs). Mirrors Auth service's pre-auth middleware needing WhoIs data before any request reaches downstream services.

**Packages added:** `@d2/request-enrichment`, `@d2/ratelimit`, `@d2/idempotency`, `@d2/interfaces`, `@d2/handler`, `@d2/logging`, `@d2/geo-client`, `@d2/cache-redis`, `@d2/cache-memory`, `@d2/result`, `@d2/service-defaults`, `ioredis`

**Files:**

| File                                                       | Purpose                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/server/middleware.server.ts`                      | Lazy singleton composition (Redis, Geo gRPC, all handlers)      |
| `src/lib/server/hooks/request-enrichment.server.ts`        | SvelteKit Handle wrapper for IP/fingerprint/WhoIs enrichment    |
| `src/lib/server/hooks/rate-limit.server.ts`                | SvelteKit Handle wrapper for multi-dimension rate limiting      |
| `src/lib/server/hooks/idempotency.server.ts`               | SvelteKit Handle wrapper for mutation dedup via Idempotency-Key |
| `src/hooks.server.ts`                                      | Wired via `sequence()` — enrichment → rate-limit → idempotency → paraglide |
| `src/app.d.ts`                                             | Added `requestInfo` to `App.Locals`                             |
| `backends/dotnet/orchestration/AppHost/AppHost.cs`         | Added Redis + Geo references to SvelteKit resource              |
| `.env.local` / `.env.local.example`                        | Added `SVELTEKIT_GEO_CLIENT__APIKEY` + Geo API key mapping      |

**Graceful degradation:** If Redis/Geo env vars are missing, `getMiddlewareContext()` returns `null` and all hooks skip (no-op). SvelteKit remains usable for frontend-only development.

**Status:** Complete

---

### Step 3: Design System Sprint (Kitchen Sink)

**Goal:** Living style guide at `/design` for visual decisions in-browser.

**Status:** Complete

**shadcn-svelte components added (19):** input, textarea, label, checkbox, radio-group, switch, select, slider, tabs, accordion, dialog, dropdown-menu, popover, sheet, skeleton, avatar, progress, scroll-area, table. Total: 27 component directories in `src/lib/components/ui/`.

**Design system page (`/design`):**
- Client-only (`ssr: false`) — DOM manipulation for live theme preview
- 10 showcase sections: Colors, Typography, Buttons, Cards, Forms, Overlays, Navigation, Feedback, Data Display
- Theme Editor side panel (Sheet) with:
  - 5 OKLCH preset palettes (Zinc, Blue, Green, Orange, Rose)
  - Sliders for primary hue/chroma/lightness, destructive hue, border radius
  - Live preview via `document.documentElement.style.setProperty()` + dynamic `<style>` for dark tokens
  - Export dialog with generated CSS (copy to clipboard)
  - Cleanup on navigation away (all style overrides removed)

**Files created:**
- `src/routes/design/+page.ts` — SSR disabled
- `src/routes/design/+page.svelte` — Main page with all sections + theme editor
- `src/lib/components/design/theme-presets.ts` — 5 preset palette definitions
- `src/lib/components/design/theme-utils.ts` — OKLCH derivation + CSS generation
- `src/lib/components/design/theme-state.svelte.ts` — Shared reactive state (Svelte 5 runes)
- `src/lib/components/design/theme-editor.svelte` — Side panel with sliders + presets
- `src/lib/components/design/export-dialog.svelte` — CSS export modal with copy
- `src/lib/components/design/section.svelte` — Reusable section wrapper
- `src/lib/components/design/color-swatch.svelte` — Token display component
- `src/lib/components/design/color-palette.svelte` — All tokens grid (light + dark)
- `src/lib/components/design/typography-showcase.svelte` — Font scale + weights
- `src/lib/components/design/button-showcase.svelte` — All variants x sizes
- `src/lib/components/design/card-showcase.svelte` — Profile, stats, notification cards
- `src/lib/components/design/form-showcase.svelte` — All form control types
- `src/lib/components/design/overlay-showcase.svelte` — Dialog, dropdown, popover, sheet
- `src/lib/components/design/navigation-showcase.svelte` — Tabs + accordion
- `src/lib/components/design/feedback-showcase.svelte` — Progress, skeleton, toasts
- `src/lib/components/design/data-display-showcase.svelte` — Avatar, badges, alerts, tooltip, toggle, separator, scroll-area, table

**MAJOR PAUSE POINT:** User reviews all components visually and makes color/spacing decisions.

---

### Step 4: Route Groups + Layout System

**Goal:** Four route groups with distinct layouts — `(public)/`, `(auth)/`, `(onboarding)/`, `(app)/`.

**Layout components:** public-nav, app-sidebar, app-header, auth-card, footer.

---

### Step 5: @d2/auth-bff-client + Auth Proxy

**Goal:** BFF auth client library + SvelteKit BetterAuth proxy.

**5A:** `@d2/auth-bff-client` package at `backends/node/services/auth/bff-client/` — JWT manager, gateway client, route protection.

**5B:** SvelteKit integration — auth proxy catch-all, session resolution in hooks, route guards.

**Requires:** Auth service running for full integration.

---

### Step 6: API Client Layer (Gateway)

**Goal:** Dual-path API client — server-side (JWT) and client-side (JWT + fingerprint).

---

### Step 7: Forms Architecture (Superforms + Formsnap)

**Goal:** Forms stack, preset fields, Zod schemas, D2Result error mapping.

**Packages:** `sveltekit-superforms`, `formsnap`

---

### Step 8: Auth Pages

**Goal:** Real auth form pages — sign-in, sign-up, forgot-password, reset-password, verify-email.

**Requires:** Auth service running.

---

### Step 9: Client Telemetry (Grafana Faro)

**Goal:** Faro for client-side error capture, browser traces, Web Vitals.

**Packages:** `@grafana/faro-web-sdk`, `@grafana/faro-web-tracing`

**Requires:** Alloy running.

---

### Step 10: Onboarding Flow

**Goal:** Post-auth onboarding — org selection/creation.

**10A:** Geo address autocomplete backend (Radar endpoint).

**10B:** Onboarding frontend — welcome, select-org, create-org pages.

**Requires:** All backend services running.

---

### Step 11: App Shell

**Goal:** Authenticated app shell — sidebar, header, org switcher, emulation banner.

---

### Step 12: SignalR Abstraction Layer

**Goal:** Client-side real-time connection via SignalR.

**Packages:** `@microsoft/signalr`

**Requires:** .NET SignalR gateway.

---

## Dependency Graph

```
Step 0 → Step 1 → Step 2 → Step 2.5 → Step 3 (VISUAL PAUSE)
                                     → Step 4 → Step 5 → Step 6 → Step 8
                                                       → Step 9
                            Step 2 → Step 7 ──────────────────→ Step 8
Step 8 → Step 10 → Step 11 → Step 12
```

Steps 0-3 require no backend services (Step 2.5 middleware degrades gracefully).

---

## Decision Log

Decisions made during implementation (appended as we go):

| Date       | Decision | Rationale |
| ---------- | -------- | --------- |
| 2026-03-01 | Plan created | — |
| 2026-03-01 | SvelteKit→Geo gRPC for FindWhoIs | Pre-auth middleware needs WhoIs data before requests reach downstream services. Calling REST gateway would be circular (gateway itself does enrichment). Direct gRPC mirrors Auth service pattern |
| 2026-03-01 | Graceful middleware degradation | SvelteKit must remain usable for local frontend dev without Redis/Geo. `getMiddlewareContext()` returns null when env vars missing, all hooks skip |
| 2026-03-01 | No DI container for SvelteKit middleware | Simplified composition — module-level lazy singletons instead of full ServiceCollection. SvelteKit only needs pre-auth handlers (no scoped request contexts yet) |

---

## Cross-Cutting Concerns

### SEO & Metadata Strategy

Every page needs proper `<title>`, `<meta name="description">`, and Open Graph tags. Strategy:

- **Root `+layout.svelte`**: Sets site-wide defaults (`<svelte:head>` with fallback title/description)
- **Route group layouts**: Override title prefix per group (e.g., "D2-WORX | Dashboard" for `(app)/`)
- **Individual pages**: Each `+page.svelte` or `+page.ts` exports page-specific title/description
- **Utility**: Shared `seo.ts` helper for consistent OG tag generation (title, description, image, canonical URL)
- **Error pages**: `+error.svelte` uses `page.status` in title (e.g., "404 — Page Not Found | D2-WORX")

### Layout Boilerplate Deduplication

Route group layouts (`(public)/`, `(auth)/`, `(app)/`, `(onboarding)/`) handle:

- Shared chrome (nav, sidebar, footer) per group
- SEO defaults per group (title template, common meta)
- Auth state checks per group (redirect if needed)
- Common wrappers (max-width containers, padding, background)

Individual pages only provide page-specific content + page-specific SEO overrides.

---

## Deviation Notes

Changes from original plan (appended as needed):

- **Step 2.5 added** (Server-Side Middleware): Inserted between Steps 2 and 3. SvelteKit needed the same request enrichment, rate limiting, and idempotency as the Auth service before continuing to UI work. Adds direct SvelteKit→Geo gRPC for FindWhoIs lookups.
