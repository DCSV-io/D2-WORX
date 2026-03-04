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
| 3    | Design System Sprint (Kitchen Sink) | Complete    | Live theme editor at `/design` with 3 OKLCH presets (WORX, Zinc, Ocean), 27 shadcn-svelte components, 10 showcase sections. Client-only (`ssr: false`), theme overrides cleaned up on navigation away |
| 3.5  | Design Review & Polish              | Complete    | Playwright-driven visual QA across all 6 theme/mode combos. Button hover visibility, ghost/outline differentiation, dark mode borders, overlay backdrops, Zinc accent fix, favicon |
| 4    | Route Groups + Layout System        | Complete    | Route groups, layouts, sidebar, branding, auth guard stubs |
| 5    | @d2/auth-bff-client + Auth Proxy    | Complete    | 32 unit tests, session resolver, JWT manager, auth proxy, route guards, SvelteKit hooks integration |
| 6    | API Client Layer (Gateway)          | Complete    | 66 tests. camelCase normalizer for mixed-casing gateway. `$env/dynamic/public` for runtime URL. |
| 6.5  | Chart Showcase (LayerChart 2.0)     | Complete    | layerchart@next + shadcn-svelte chart. 5 chart types: area, bar, line, donut, sparkline. Uses `--chart-1`..`--chart-5` tokens. |
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
- 10 showcase sections: Colors, Typography, Buttons, Cards, Forms, Overlays, Navigation, Feedback, Data Display, Layout & Patterns
- Theme Editor side panel (Sheet) with:
  - 3 built-in OKLCH preset palettes (WORX default, Zinc, Ocean) + custom preset save/delete
  - Color pickers for all 7 roles (primary, secondary, accent, destructive, info, success, warning)
  - Border radius slider
  - Live preview via `document.documentElement.style.setProperty()` + dynamic `<style>` for dark tokens
  - Export dialog with generated CSS (copy to clipboard)
  - Cleanup on navigation away (all style overrides removed)
- Theme selector dropdown in header for quick preset switching

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

**MAJOR PAUSE POINT:** User reviews all components visually and makes color/spacing decisions. *(Done — see Step 3.5)*

---

### Step 3.5: Design Review & Polish

**Goal:** Playwright-driven visual QA across all 6 theme/mode combinations (WORX/Zinc/Ocean × Light/Dark). Fix UX bugs found during review.

**Status:** Complete

**Fixes applied:**
- Button hover visibility: default/destructive opacity increased for perceptible hover in both modes
- Ghost vs outline hover differentiation: ghost uses `bg-muted`, outline uses `bg-accent/15`
- Outline hover text: removed `text-accent-foreground` swap (white text on light tinted bg)
- Disabled dark mode visibility: increased to `opacity-60`
- Dark mode border/input contrast: `--border` 13%→18%, `--input` 15%→22%
- Overlay backdrops: `dark:bg-black/60` on sheet, dialog, alert-dialog overlays
- Zinc accent differentiation: shifted hue from 250 (blue-violet) → 310 (magenta) to separate from secondary
- AlertDialog action button: uses destructive styling in overlay showcase
- Theme editor reset label: corrected from "Reset to Zinc" → "Reset to WORX"
- Added D2-branded SVG favicon + `<link>` in `app.html`

---

### Step 4: Route Groups + Layout System

**Goal:** Create the full route group folder structure with distinct layouts per group, functional sidebar shell, and placeholder pages. Auth guards are stubbed (wired in Step 5).

**Status:** Complete

#### Route Structure

```
src/routes/
├── +layout.svelte                    # Root: CSS, ModeWatcher, Toaster, favicon
├── +layout.server.ts                 # Root: session resolution (stub until Step 5)
├── +page.svelte                      # Root redirect → /app/dashboard or /sign-in
├── +error.svelte                     # Global error page (exists)
│
├── (public)/                         # Marketing / unauthenticated pages
│   ├── +layout.svelte                # PublicNav + footer, no sidebar
│   └── +page.svelte                  # Landing / homepage placeholder
│
├── (auth)/                           # Auth flow pages (sign-in, sign-up, etc.)
│   ├── +layout.svelte                # Centered card layout, no nav/sidebar
│   ├── +layout.server.ts             # Redirect to /app if already authenticated
│   └── sign-in/+page.svelte          # Placeholder (real form in Step 8)
│
├── (onboarding)/                     # Post-auth, no active org
│   ├── +layout.svelte                # Minimal centered layout, no sidebar
│   ├── +layout.server.ts             # Requires auth, no org needed (stub)
│   └── welcome/+page.svelte          # Placeholder (real flow in Step 10)
│
├── (app)/                            # Main authenticated app
│   ├── +layout.svelte                # App shell: sidebar + header + main area
│   ├── +layout.server.ts             # Requires auth + active org (stub)
│   ├── (customer)/
│   │   └── dashboard/+page.svelte    # Customer dashboard placeholder
│   ├── (support)/
│   │   └── dashboard/+page.svelte    # Support dashboard placeholder
│   ├── (admin)/
│   │   └── dashboard/+page.svelte    # Admin dashboard placeholder
│   └── (shared)/
│       ├── settings/+page.svelte     # Settings placeholder
│       └── profile/+page.svelte      # Profile placeholder
│
├── api/                              # API routes (exists)
│   └── client-error/+server.ts       # Client error logging (exists)
│
└── design/                           # Design system kitchen sink (exists)
    └── +page.svelte
```

#### Layout Components

| Component | Location | Description |
| --------- | -------- | ----------- |
| `app-sidebar` | `src/lib/components/layout/app-sidebar.svelte` | shadcn-svelte `Sidebar` component — collapsible, responsive, icon+label nav items. Hardcoded placeholder items (Dashboard, Settings, Profile) replaced with org-specific items in Step 11 |
| `app-header` | `src/lib/components/layout/app-header.svelte` | Sticky top bar — breadcrumb area (left), theme toggle + user avatar placeholder (right). Hamburger trigger for mobile sidebar |
| `public-nav` | `src/lib/components/layout/public-nav.svelte` | Simple marketing header — D2-WORX logo, minimal nav links, sign-in CTA |
| `public-footer` | `src/lib/components/layout/public-footer.svelte` | Minimal footer — copyright, links |

#### Layout Details Per Group

**`(public)/+layout.svelte`** — PublicNav at top, footer at bottom, content centered with max-width container. No sidebar.

**`(auth)/+layout.svelte`** — Vertically centered card (like shadcn login pages). D2-WORX logo above, theme toggle in corner. No nav/sidebar. `+layout.server.ts` redirects authenticated users away.

**`(onboarding)/+layout.svelte`** — Minimal centered layout (similar to auth but wider content area for org selection/creation). D2-WORX logo, sign-out link. `+layout.server.ts` requires auth, redirects if user already has an active org.

**`(app)/+layout.svelte`** — Full app shell using shadcn-svelte `SidebarProvider` + `Sidebar` + `SidebarInset`. Collapsible sidebar on left, sticky header at top, scrollable main content area. `+layout.server.ts` requires auth + active org, redirects to onboarding if no org.

#### Packages to Add

- `npx shadcn-svelte@latest add sidebar` — Sidebar component (not yet installed)

#### Sidebar Specifics

- Uses shadcn-svelte `Sidebar` component (`SidebarProvider`, `Sidebar`, `SidebarInset`, etc.)
- Desktop: collapsible (icon+label ↔ icon-only), persists preference
- Mobile: sheet/drawer triggered by hamburger in header
- Placeholder nav items for now: Dashboard, Settings, Profile (all link to `(shared)` routes)
- Step 11 replaces with org-type-specific nav items based on JWT `orgType` claim

#### Auth Guard Pattern (Stubbed)

Until Step 5 wires real BetterAuth session resolution, `+layout.server.ts` files use a stub pattern:

```typescript
// (app)/+layout.server.ts — stub until Step 5
export async function load({ locals }) {
  // TODO: Step 5 — wire real session from locals
  // if (!locals.session) throw redirect(303, '/sign-in');
  // if (!locals.session.activeOrganizationId) throw redirect(303, '/onboarding/welcome');

  return {
    // Placeholder data until auth is wired
    orgType: 'customer' as const,
    role: 'owner' as const,
  };
}
```

#### App.d.ts Updates

```typescript
interface Locals {
  requestInfo?: RequestEnrichment.IRequestInfo;  // exists
  session?: {                                     // stub shape
    userId: string;
    activeOrganizationId?: string;
    activeOrganizationType?: string;
    activeOrganizationRole?: string;
  };
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}
```

#### Files to Create

| File | Purpose |
| ---- | ------- |
| `src/lib/components/layout/app-sidebar.svelte` | App sidebar shell using shadcn Sidebar |
| `src/lib/components/layout/app-header.svelte` | Sticky header with mobile trigger |
| `src/lib/components/layout/public-nav.svelte` | Marketing header |
| `src/lib/components/layout/public-footer.svelte` | Marketing footer |
| `src/routes/+layout.server.ts` | Root server layout (session stub) |
| `src/routes/(public)/+layout.svelte` | Public layout wrapper |
| `src/routes/(public)/+page.svelte` | Landing page placeholder |
| `src/routes/(auth)/+layout.svelte` | Auth centered card layout |
| `src/routes/(auth)/+layout.server.ts` | Redirect if authenticated |
| `src/routes/(auth)/sign-in/+page.svelte` | Sign-in placeholder |
| `src/routes/(onboarding)/+layout.svelte` | Onboarding layout |
| `src/routes/(onboarding)/+layout.server.ts` | Requires auth, no org |
| `src/routes/(onboarding)/welcome/+page.svelte` | Welcome placeholder |
| `src/routes/(app)/+layout.svelte` | App shell (sidebar + header) |
| `src/routes/(app)/+layout.server.ts` | Requires auth + active org |
| `src/routes/(app)/(customer)/dashboard/+page.svelte` | Customer dashboard placeholder |
| `src/routes/(app)/(support)/dashboard/+page.svelte` | Support dashboard placeholder |
| `src/routes/(app)/(admin)/dashboard/+page.svelte` | Admin dashboard placeholder |
| `src/routes/(app)/(shared)/settings/+page.svelte` | Settings placeholder |
| `src/routes/(app)/(shared)/profile/+page.svelte` | Profile placeholder |

#### What This Step Does NOT Include

- Real auth session resolution (Step 5)
- Auth proxy routes `/api/auth/*` (Step 5)
- Real sign-in/sign-up forms (Step 8)
- Real onboarding flow (Step 10)
- Org-type-specific nav items (Step 11)
- Org switcher, emulation banner (Step 11)
- Breadcrumb data from route metadata (Step 11)

---

### Step 5: @d2/auth-bff-client + Auth Proxy

**Goal:** BFF auth client library + SvelteKit BetterAuth proxy.

**Status:** Complete

**5A:** `@d2/auth-bff-client` package at `backends/node/services/auth/bff-client/` — SessionResolver, JwtManager, AuthProxy, route guards (requireAuth, requireOrg, redirectIfAuthenticated). 32 unit tests.

**5B:** SvelteKit integration — auth proxy catch-all at `/api/auth/[...path]`, session resolution in hooks.server.ts (after enrichment, before paraglide), route guards wired in all layout.server.ts files. Client-side BetterAuth client store at `src/lib/stores/auth-client.ts`.

**5C:** Environment — `SVELTEKIT_AUTH__URL` env var, Aspire wiring (`.WaitFor(authService)`, `.WithEnvironment()`).

**Requires:** Auth service running for full integration. Graceful degradation when unavailable.

#### Files Created/Modified

| File | Action |
| ---- | ------ |
| `backends/node/services/auth/bff-client/` | Created — full package (6 source files, 4 test files) |
| `clients/web/src/lib/server/auth.server.ts` | Created — lazy singleton auth context |
| `clients/web/src/lib/server/hooks/auth.server.ts` | Created — auth hook for sequence() |
| `clients/web/src/routes/api/auth/[...path]/+server.ts` | Created — auth proxy catch-all |
| `clients/web/src/routes/(public)/+page.server.ts` | Created — auth-aware root redirect |
| `clients/web/src/lib/stores/auth-client.ts` | Created — browser-side BetterAuth client |
| `clients/web/src/hooks.server.ts` | Modified — added createAuthHandle to sequence |
| `clients/web/src/app.d.ts` | Modified — imports AuthSession/AuthUser from bff-client |
| `clients/web/src/routes/(auth)/+layout.server.ts` | Modified — wired redirectIfAuthenticated |
| `clients/web/src/routes/(onboarding)/+layout.server.ts` | Modified — wired requireAuth |
| `clients/web/src/routes/(app)/+layout.server.ts` | Modified — wired requireOrg |
| `clients/web/package.json` | Modified — added @d2/auth-bff-client + better-auth deps |
| `AppHost.cs` | Modified — added .WaitFor(authService) + .WithEnvironment() |
| `.env.local` / `.env.local.example` | Modified — added SVELTEKIT_AUTH__URL |

---

### Step 6: API Client Layer (Gateway)

**Goal:** Dual-path API client — server-side (JWT + service key) and client-side (JWT + fingerprint).

**Status:** Complete

**Files:**

| File                                         | Purpose                                                      |
| -------------------------------------------- | ------------------------------------------------------------ |
| `src/lib/utils/gateway-response.ts`          | Parse gateway Response → D2Result with camelCase normalizer  |
| `src/lib/utils/idempotency.ts`               | Idempotency-Key UUID generation (isomorphic)                 |
| `src/lib/server/gateway.server.ts`           | Server-side gateway client (lazy singleton, JWT + service key)|
| `src/lib/utils/gateway-client.ts`            | Client-side gateway client (JWT + fingerprint, 401 retry)    |
| `src/routes/+layout.server.ts`               | Modified — pass `clientFingerprint` to browser via layout data|
| `src/routes/+layout.svelte`                  | Modified — initialize fingerprint on mount                   |
| `.env.local.example`                         | Modified — add gateway env vars                              |
| `backends/.../AppHost/AppHost.cs`            | Modified — wire gateway URLs to SvelteKit resource           |

**Tests:** 66 tests across 5 files (gateway-response: 21, idempotency: 2, gateway.server: 17, gateway-client: 18, layout.server: 5 + 3 existing).

**Key decisions:**
- **Casing normalization**: Gateway sends PascalCase (endpoints) and camelCase (middleware errors). Single recursive `normalizeKeys()` function converts all keys to camelCase in one pass — no per-property `??` fallbacks
- **HTTP status authority**: `response.status` is the authoritative statusCode, not the body field (avoids int vs string inconsistency)
- **Dynamic env**: `$env/dynamic/public` for `PUBLIC_GATEWAY_URL` (runtime, not build-time)
- **Service key bypass**: Server-side calls include `X-Api-Key` for trusted-service fingerprint bypass
- **JWT caching (client)**: In-memory only (XSS safety), auto-refresh 2min before expiry, single 401 retry

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
Step 0 → Step 1 → Step 2 → Step 2.5 → Step 3 → Step 3.5 (VISUAL PAUSE ✓)
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
| 2026-03-03 | HTTP proxy over local BetterAuth | Local BetterAuth would bypass Auth service's rate limiting, fingerprint binding, throttle tracking, sign-in event recording |
| 2026-03-03 | Tests co-located in bff-client (not auth-tests) | Lightweight package with mocked HTTP — no Testcontainers needed, faster feedback loop |
| 2026-03-03 | better-auth as SvelteKit dep | Client SDK needed for browser-side auth operations (sign-in, sign-out, reactive session). Pinned at 1.5.0 to match auth-infra |
| 2026-03-01 | Plan created | — |
| 2026-03-01 | SvelteKit→Geo gRPC for FindWhoIs | Pre-auth middleware needs WhoIs data before requests reach downstream services. Calling REST gateway would be circular (gateway itself does enrichment). Direct gRPC mirrors Auth service pattern |
| 2026-03-01 | Graceful middleware degradation | SvelteKit must remain usable for local frontend dev without Redis/Geo. `getMiddlewareContext()` returns null when env vars missing, all hooks skip |
| 2026-03-01 | No DI container for SvelteKit middleware | Simplified composition — module-level lazy singletons instead of full ServiceCollection. SvelteKit only needs pre-auth handlers (no scoped request contexts yet) |
| 2026-03-02 | 3 built-in presets (WORX, Zinc, Ocean) | Cut Slate/Ember/Forest, refined remaining presets for distinct identity. WORX as default (heritage theme) |
| 2026-03-02 | Design polish via Playwright QA | Systematic visual review of all 6 theme/mode combos before proceeding to route architecture |

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
- **Step 3.5 added** (Design Review & Polish): Post-Step-3 visual QA pass using Playwright. Systematic review of all theme/mode combinations caught 11 issues (button hover visibility, dark mode contrast, overlay backdrops, etc.).
