# D2-WORX Web Client

## Overview

The **Web Client** is a SvelteKit 5 application that serves as the primary user interface for D2-WORX. It provides SSR-capable pages, BetterAuth session management (cookie-based), and communicates with backend services via the .NET REST Gateway using JWT authentication.

**Runtime:** Node.js (SvelteKit + adapter-node)
**Framework:** Svelte 5 (runes) + SvelteKit 2
**Styling:** Tailwind CSS v4 (Vite plugin, CSS-based theming)
**i18n:** Paraglide (5 locales: en, es, de, fr, jp)
**Observability:** OpenTelemetry (server-side wired, client-side pending)

> **Not a standalone app.** The web client depends on the .NET REST Gateway for all data operations and on the Auth Service (proxied through SvelteKit) for authentication. It is orchestrated via Aspire alongside all backend services.

---

## Architecture

### Request Flow (Hybrid Pattern C)

Two coexisting paths — SSR through SvelteKit server, interactive calls direct to gateway:

```
SSR / slow-changing data:
  Browser ──cookie──► SvelteKit Server ──JWT──► .NET Gateway ──gRPC──► Services

Interactive client-side (search, forms, real-time):
  Browser ──JWT──► .NET Gateway ──gRPC──► Services

Auth (always proxied, cookie-based):
  Browser ──cookie──► SvelteKit ──proxy──► Auth Service
```

### Auth Integration

- **BetterAuth** proxied through SvelteKit (`/api/auth/*` catch-all)
- **Sessions:** Cookie-based between Browser ↔ SvelteKit (httpOnly, secure)
- **JWTs:** RS256, 15-minute expiry, obtained via `authClient.token()`, stored in memory only (never localStorage)
- **Route protection:** Server-side in `hooks.server.ts` (no client-side flash of unauthenticated content)

### Route Groups (Planned)

| Group | Purpose | Auth Required | Org Required |
| --- | --- | --- | --- |
| `(public)/` | Marketing, legal, pricing | No | No |
| `(auth)/` | Sign-in, sign-up, password reset | No | No |
| `(onboarding)/` | Welcome, create/select org | Yes | No |
| `(app)/` | Main authenticated application | Yes | Yes |

The `(app)/` group is further subdivided by org type: `(customer)/`, `(support)/`, `(admin)/`, `(shared)/`.

---

## Documentation Index

| Document | Description |
| --- | --- |
| [`SVELTEKIT_STRATEGY.md`](SVELTEKIT_STRATEGY.md) | Comprehensive strategy report: old system analysis, library recommendations, form architecture, testing, client-side telemetry |

---

## Tech Stack

### Current Dependencies

| Category | Package | Version | Status |
| --- | --- | --- | --- |
| Framework | `svelte` | 5.53.5 | Installed |
| Framework | `@sveltejs/kit` | 2.53.3 | Installed |
| Build | `vite` | 7.3.1 | Installed |
| Styling | `tailwindcss` | 4.2.1 | Installed |
| Styling | `clsx` + `tailwind-merge` | 2.1.1 / 3.5.0 | Installed |
| Styling | `tailwind-variants` | 3.2.2 | Installed |
| Styling | `tailwindcss-motion` | 1.1.1 | Installed |
| Validation | `zod` | 4.3.6 | Installed |
| i18n | `@inlang/paraglide-js` | 2.13.0 | Installed |
| Phone | `libphonenumber-js` | 1.12.38 | Installed |
| Postal codes | `postcode-validator` | 3.10.9 | Installed |
| Payments | `@stripe/stripe-js` | 8.8.0 | Installed |
| OTel (server) | `@opentelemetry/sdk-node` + exporters | Various | Installed + wired |
| OTel (client) | `@opentelemetry/sdk-trace-web` | 2.5.0 | Installed, not wired |
| Testing | `vitest` + `@vitest/browser` + `playwright` | 4.0.18 / 1.58.0 | Installed |

### Planned Additions

| Category | Package | Purpose |
| --- | --- | --- |
| UI | `shadcn-svelte` (Bits UI) | Component library |
| Forms | `sveltekit-superforms` + `formsnap` | Form management + accessible markup |
| Toast | `svelte-sonner` | Notifications |
| Phone | `intl-tel-input` | Phone input with country picker |
| Tables | `@tanstack/table-core` | Data tables (via shadcn-svelte) |
| Dates | `@internationalized/date` + `date-fns` | Date components + utilities |
| Auth | `better-auth` | BetterAuth client + SvelteKit handler |
| Telemetry | `@grafana/faro-web-sdk` | Client-side error/trace/metric collection |
| Testing | `@axe-core/playwright` | Accessibility testing in E2E |
| Testing | `@lhci/cli` | Lighthouse CI performance budgets |

---

## What's In Place

- SvelteKit 2.53.3 with Svelte 5.53.5, adapter-node, Vite 7.3.1
- Tailwind CSS v4 via Vite plugin (no theme customization yet)
- Paraglide i18n with 5 locales, 1 demo message, server middleware, URL reroute
- mdsvex preprocessor for `.svx` markdown-in-Svelte files
- Full server-side OTel (traces, logs, metrics via OTLP/HTTP to Alloy)
- Structured server logger with OTel trace correlation
- Vitest dual-project setup (browser + server) with Playwright provider
- Playwright E2E config
- Aspire orchestration wired (`AddViteApp` with `.WithPnpm()`)

## What's Not Yet In Place

- Auth integration (no BetterAuth, no proxy routes, no session handling)
- `App.Locals` / `App.Error` type definitions (commented-out stubs)
- Client-side OTel / Faro (packages installed, not wired)
- Custom Tailwind theme / design tokens
- `hooks.client.ts` (no client-side error handling)
- `+error.svelte` / `error.html` (no error pages)
- No components, stores, API client, or route groups
- No `+layout.server.ts` or `+page.server.ts` files

---

## Development

### Prerequisites

- Node.js 22+
- pnpm 10+
- All backend services running via Aspire (or manually)

### Commands

```bash
pnpm dev              # Start dev server (port 5173)
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm check            # Type checking (svelte-check)
pnpm test:unit        # Vitest (component + server tests)
pnpm test:e2e         # Playwright E2E tests
pnpm test             # All tests
```

### Environment Variables

| Variable | Purpose | Required |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint | For observability |
| `OTEL_SERVICE_NAME` | Service name for traces/logs | For observability |

Additional environment variables will be documented as auth and gateway integration are implemented.

---

## Testing Strategy

| Level | Tool | File Pattern | Environment |
| --- | --- | --- | --- |
| Unit | Vitest (Node) | `*.test.ts` | Node |
| Component | vitest-browser-svelte | `*.svelte.test.ts` | Browser (Chromium) |
| E2E | Playwright | `e2e/*.spec.ts` | Browser (full app) |
| Accessibility | axe-core/playwright | In E2E suite | Browser |
| Visual | Playwright screenshots | In E2E suite | Browser |
| Performance | Lighthouse CI | CI pipeline | Browser |

See [`SVELTEKIT_STRATEGY.md` §7](SVELTEKIT_STRATEGY.md#7-frontend-testing-strategy) for full testing architecture.
