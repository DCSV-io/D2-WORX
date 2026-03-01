# D2-WORX Quarterly Dependency Upgrade Report — 2026 Q1

**Date:** 2026-02-28
**Branch:** `chore/2026-Q1-pkg-upgrades`
**Scope:** All .NET packages, Node.js packages, SvelteKit frontend, and container images

---

## Executive Summary

**Total dependencies audited:** ~140 (6 platform runtimes, 52 NuGet, 62+ npm, 19 container images)

### Current Platform Versions

| Platform | Current | Latest Stable | Gap | Status |
| -------- | ------- | ------------- | --- | ------ |
| .NET SDK | 10.0.100 (implicit) | **10.0.103** | 3 patches (**CVE-2026-21218**) | ~~DONE~~ |
| Node.js | 24.7.0 (engines ≥22) | **24.14.0** LTS | 7 minor releases | ~~DONE~~ |
| pnpm | 10.15.1 | **10.30.3** | 15 minor releases | ~~DONE~~ |
| TypeScript | 5.9.3 | **5.9.3** | Current | ~~N/A~~ |
| Svelte | 5.39.8 | **5.53.5** | 14 minor releases | |
| SvelteKit | 2.43.8 | **2.53.3** | 10 minor releases | |
| .NET Aspire | 13.0.0 | **13.1.2** | 1 minor + 2 patches | ~~DONE~~ |

### Quick Stats

| Category   | Already Latest | Simple Bump | Needs Attention | Major / Hold |
| ---------- | -------------- | ----------- | --------------- | ------------ |
| Platform   | 1              | 5           | 1               | 0            |
| .NET       | 9              | 18          | 2               | 1            |
| Node.js    | 12             | 8           | 3               | 5            |
| Frontend   | 6              | 14          | 1               | 1            |
| Containers | 1              | 10          | 3               | 2            |

### Critical Findings

1. ~~**.NET SDK 10.0.100** needs immediate update to **10.0.103** — includes fix for **CVE-2026-21218** (security feature bypass vulnerability).~~ **DONE** — `global.json` pins SDK 10.0.103.
2. ~~**Node.js 22 is EOL** (January 12, 2026). The `engines` field still allows `>=22.0.0`. Tighten to `>=24.0.0` and ensure Node 24.14.0 LTS is installed.~~ **DONE** — engines updated, Node 24.14.0 installed.
3. ~~**`Microsoft.Extensions.Caching.Memory`** is on `10.0.0-rc.2` — a release candidate on a GA package. Must fix.~~ **DONE** — bumped to 10.0.3.
4. ~~**gRPC packages** are on `2.76.0-pre1` — stable `2.76.0` is available. Must fix.~~ **DONE** — all 3 gRPC packages bumped to 2.76.0.
5. ~~**CommunityToolkit Aspire extension** is on beta — stable `13.1.1` now available. Must fix.~~ **DONE** — bumped to 13.1.1 with Aspire 13.1.2 upgrade.
6. **MinIO is archived.** The project was archived on GitHub on 2026-02-13. Current pinned images work, but no future updates. Evaluate alternatives (Garage, RustFS, SeaweedFS) as a separate effort.
7. **Zod split versions** — backend on `3.25.76`, web on `4.1.11`. Unification to Zod 4 requires schema migration across all handlers.
8. **Vitest 4.0** is available with breaking changes (workspace config rename, mock constructor behavior). Coordinated monorepo upgrade needed.
9. **Serilog.Enrichers.Span** is deprecated upstream — Serilog now natively supports span data. Plan removal.
10. **better-auth 1.5.0** released today (2026-02-28). Minor version with 600+ commits. D2-WORX avoids all breaking changes — upgrade is low-risk thanks to isolated `@d2/auth-infra` usage. Key wins: security hardening (OTP reuse prevention, enumeration prevention, stricter rate limits), `/update-session` endpoint, typed error codes. `@better-auth/cli` is deprecated (replace with `npx auth`).

---

## Platform & Runtime Dependencies

### ~~.NET SDK / Runtime~~ DONE

| | |
| --- | --- |
| **Current** | ~~SDK 10.0.100 (implicit — no `global.json`)~~ → **SDK 10.0.103** (pinned via `global.json`), Runtime 10.0.3, Target: `net10.0` |
| **Latest** | SDK **10.0.103**, Runtime **10.0.3** (Feb 10, 2026) |
| **Status** | .NET 10 is **LTS** (supported through Nov 2028). .NET 11 Preview 1 announced but not relevant. |
| **Security** | **CVE-2026-21218**: ".NET Security Feature Bypass Vulnerability" — fixed in 10.0.3. |
| **Breaking changes** | None. Pure servicing patches. TargetFramework stays `net10.0`. |
| **Migration** | ~~Install SDK 10.0.103. `dotnet build` + `dotnet test`. No code changes. Consider adding `global.json` to pin SDK version.~~ |
| **Recommendation** | ~~**Immediate.** Security CVE.~~ **COMPLETE.** |

### ~~Node.js~~ DONE

| | |
| --- | --- |
| **Current** | ~~24.7.0 (engines field: `>=22.0.0`)~~ → **24.14.0** (engines: `>=24.0.0`) |
| **Latest** | **24.14.0** "Krypton" Active LTS (Feb 24, 2026) |
| **Status** | Node 24 entered Active LTS in Oct 2025, maintained until Apr 2028. **Node 22 reached EOL on Jan 12, 2026.** |
| **Breaking changes** | None within 24.x (24.7 → 24.14 is semver-minor). |
| **Migration** | ~~Install Node 24.14.0. Update `engines.node` in root `package.json` from `>=22.0.0` to `>=24.0.0` (Node 22 is EOL). `pnpm install` + test suite.~~ |
| **Recommendation** | ~~**High priority.** Security patches + engines field cleanup.~~ **COMPLETE.** |

### ~~pnpm~~ DONE

| | |
| --- | --- |
| **Current** | ~~10.15.1 (engines: `>=10.0.0`, lockfileVersion: 9.0)~~ → **10.30.3** (engines: `>=10.15.0`) |
| **Latest** | **10.30.3** (Feb 26, 2026) |
| **Status** | pnpm 11 is in alpha (not production-ready). 10.x is the stable line. |
| **Breaking changes** | None within 10.x. Bug fixes for peer deps, Windows lifecycle scripts, audit endpoints. |
| **Migration** | ~~`corepack prepare pnpm@10.30.3 --activate` or `pnpm self-update`. `pnpm install` (may regenerate some lockfile entries).~~ |
| **Recommendation** | ~~**Recommended.** Straightforward minor bump.~~ **COMPLETE.** |

### TypeScript

| | |
| --- | --- |
| **Current** | 5.9.3 |
| **Latest** | **5.9.3** |
| **Status** | Already at latest stable. TypeScript 6.0 beta announced but not stable. |
| **Recommendation** | **No action.** Already current. |

### Svelte

| | |
| --- | --- |
| **Current** | 5.39.8 |
| **Latest** | **5.53.5** (~Feb 26, 2026) |
| **Status** | Svelte 6 not announced. 5.x remains the active line. |
| **Breaking changes** | None. All 5.39→5.53 changes are backward-compatible bug fixes and enhancements (hydration fixes, SSR improvements, Node 24 support in adapters). |
| **Migration** | Bump version in `clients/web/package.json`. Run `svelte-check`. |
| **Recommendation** | **Recommended.** Routine catchup, zero risk. |

### SvelteKit

| | |
| --- | --- |
| **Current** | 2.43.8 |
| **Latest** | **2.53.3** (~Feb 27, 2026) |
| **Status** | SvelteKit 3 not announced. 2.x remains active. 2.53.0 adds Vite 8 support (not needed yet). |
| **Breaking changes** | None for standard usage. Experimental `buttonProps` removed in 2.50.0 (only relevant if using experimental remote form functions). |
| **Migration** | Bump version in `clients/web/package.json`. Update `@sveltejs/adapter-node` alongside. |
| **Recommendation** | **Recommended.** Routine catchup, zero risk. |

### ~~.NET Aspire~~ DONE

| | |
| --- | --- |
| **Current** | ~~13.0.0 (all packages)~~ → **13.1.2** (all Aspire packages), **CommunityToolkit 13.1.1** (stable) |
| **Latest** | **13.1.2** (Feb 26, 2026). No Aspire 14 announced. |
| **What's new** | MCP integration for AI coding agents, dashboard improvements (Parameters tab, GenAI visualizer), container registry support, TLS termination APIs, JavaScript starter template. |
| **Breaking changes** | `AddAzureRedisEnterprise` renamed (not used by D2-WORX). **Redis TLS default:** `AddRedis` now enables TLS by default — clients connecting plaintext to port 6379 get SSL errors. Fixed with `.WithoutHttpsCertificate()` (experimental API, suppressed `ASPIRECERTIFICATES001`). |
| **Migration** | ~~`dotnet aspire update` or manually bump all `Aspire.*` packages to 13.1.2. Also bump `CommunityToolkit` from beta to 13.1.1 stable. Add `.WithoutHttpsCertificate()` to Redis resource in AppHost.cs.~~ |
| **Recommendation** | ~~**Recommended with testing.** Verify Redis connectivity in dev after upgrade.~~ **COMPLETE.** Build verified clean. Redis TLS fix applied. |

---

## .NET Packages

### ~~Tier 1 — Fix Immediately (pre-release → stable)~~ ALL DONE

| Package | Current | Latest | Risk | Notes |
| ------- | ------- | ------ | ---- | ----- |
| ~~`Microsoft.Extensions.Caching.Memory`~~ | ~~10.0.0-rc.2.25502.107~~ | ~~**10.0.3**~~ | ~~NONE~~ | ~~RC on a GA package — leftover from .NET 10 preview. Just bump version.~~ **DONE** |
| ~~`Grpc.AspNetCore`~~ | ~~2.76.0-pre1~~ | ~~**2.76.0**~~ | ~~NONE~~ | ~~Pre-release → same-version stable. No API changes.~~ **DONE** |
| ~~`Grpc.Net.Client`~~ | ~~2.76.0-pre1~~ | ~~**2.76.0**~~ | ~~NONE~~ | ~~Same as above.~~ **DONE** |
| ~~`Grpc.Net.ClientFactory`~~ | ~~2.76.0-pre1~~ | ~~**2.76.0**~~ | ~~NONE~~ | ~~Same as above.~~ **DONE** |
| ~~`CommunityToolkit.Aspire.Hosting.JavaScript.Extensions`~~ | ~~13.0.0-beta.444~~ | ~~**13.1.1**~~ | ~~NONE~~ | ~~Beta → stable. No API changes.~~ **DONE** |

### Tier 2 — Standard Upgrades (low risk)

| Package | Current | Latest | Risk | Notes |
| ------- | ------- | ------ | ---- | ----- |
| ~~`Aspire.Hosting.*` (all 8 packages)~~ | ~~13.0.0~~ | ~~**13.1.2**~~ | ~~LOW~~ | ~~Verify Redis connection string in dev — 13.1 may add `ssl=true` by default.~~ **DONE** |
| `Microsoft.EntityFrameworkCore` | 10.0.0 | **10.0.3** | — | **HELD** — `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.0 pins `EFCore.Relational` to 10.0.0. Bumping causes MSB3277 assembly conflict. Wait for Npgsql EF provider 10.0.x. |
| `Microsoft.EntityFrameworkCore.Design` | 10.0.0 | **10.0.3** | — | **HELD** — same as above. |
| `Microsoft.EntityFrameworkCore.InMemory` | 10.0.0 | **10.0.3** | — | **HELD** — same as above. |
| ~~`Npgsql`~~ | ~~10.0.0~~ | ~~**10.0.1**~~ | ~~NONE~~ | ~~Bug fix patch.~~ **DONE** |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 10.0.0 | **10.0.0** | — | Already at latest. |
| ~~`Microsoft.AspNetCore.Authentication.JwtBearer`~~ | ~~10.0.0~~ | ~~**10.0.3**~~ | ~~NONE~~ | ~~Servicing patch.~~ **DONE** |
| ~~`Microsoft.AspNetCore.OpenApi`~~ | ~~10.0.0~~ | ~~**10.0.3**~~ | ~~NONE~~ | ~~Servicing patch.~~ **DONE** |
| ~~`Microsoft.Extensions.Http.Resilience`~~ | ~~10.0.0~~ | ~~**10.3.0**~~ | ~~LOW~~ | ~~3 minor bumps. Additive features, no breaking changes.~~ **DONE** |
| ~~`Microsoft.Extensions.ServiceDiscovery`~~ | ~~10.0.0~~ | ~~**10.3.0**~~ | ~~LOW~~ | ~~Same as above.~~ **DONE** |
| ~~`Microsoft.Extensions.Options.ConfigurationExtensions`~~ | ~~10.0.2~~ | ~~**10.0.3**~~ | ~~NONE~~ | ~~Servicing patch.~~ **DONE** |
| ~~`Microsoft.Extensions.DependencyInjection.Abstractions`~~ | ~~10.0.0~~ | ~~**10.0.3**~~ | ~~NONE~~ | ~~Servicing patch.~~ **DONE** |
| ~~`Microsoft.Extensions.Hosting.Abstractions`~~ | ~~10.0.0~~ | ~~**10.0.3**~~ | ~~NONE~~ | ~~Servicing patch.~~ **DONE** |
| ~~`Microsoft.Extensions.Logging.Abstractions`~~ | ~~10.0.0~~ | ~~**10.0.3**~~ | ~~NONE~~ | ~~Servicing patch.~~ **DONE** |
| ~~`Microsoft.Extensions.Configuration`~~ | ~~10.0.0~~ | ~~**10.0.3**~~ | ~~NONE~~ | ~~Servicing patch.~~ **DONE** |
| ~~`Grpc.Tools`~~ | ~~2.76.0~~ | ~~**2.78.0**~~ | ~~LOW~~ | ~~Proto compiler update. Regenerate protos after upgrade.~~ **DONE** |
| ~~`Google.Protobuf`~~ | ~~3.33.1~~ | ~~**3.34.0**~~ | ~~LOW~~ | ~~Minor bump. Regenerate protos.~~ **DONE** |
| ~~`StackExchange.Redis`~~ | ~~2.9.32~~ | ~~**2.11.8**~~ | ~~LOW~~ | ~~`StringSetAsync` overload changed `TimeSpan?` → `Expiration` struct. Fixed in `Set.cs`, `SetNx.cs` (pattern match: `is { } ttl ? ttl : Expiration.Default`). `AcquireLock.cs` (non-nullable `TimeSpan`) worked via implicit conversion.~~ **DONE** |
| ~~`RabbitMQ.Client`~~ | ~~7.1.2~~ | ~~**7.2.1**~~ | ~~LOW~~ | ~~Minor bump. Better disposable handling, OAuth2 v2.~~ **DONE** |
| ~~`Serilog.AspNetCore`~~ | ~~9.0.0~~ | ~~**10.0.0**~~ | ~~LOW~~ | ~~Major version number aligns with .NET 10 versioning — not an API overhaul.~~ **DONE** |
| ~~`Serilog.Enrichers.ClientInfo`~~ | ~~2.6.0~~ | ~~**2.9.0**~~ | ~~LOW~~ | ~~Minor bump. New enrichment capabilities.~~ **DONE** |
| ~~`Serilog.Sinks.Grafana.Loki`~~ | ~~8.3.1~~ | ~~**8.3.2**~~ | ~~NONE~~ | ~~Bug fix patch.~~ **DONE** |
| ~~`OpenTelemetry.Exporter.OpenTelemetryProtocol`~~ | ~~1.14.0~~ | ~~**1.15.0**~~ | ~~LOW~~ | ~~Minor bump. **Breaking:** `OTEL_SDK_DISABLED=true` causes NullReferenceException in `OpenTelemetryMetricsListener`. Fixed by guarding `ConfigureOpenTelemetry()` call.~~ **DONE** |
| ~~`OpenTelemetry.Extensions.Hosting`~~ | ~~1.14.0~~ | ~~**1.15.0**~~ | ~~LOW~~ | ~~Minor bump.~~ **DONE** |
| ~~`OpenTelemetry.Instrumentation.AspNetCore`~~ | ~~1.14.0~~ | ~~**1.15.0**~~ | ~~LOW~~ | ~~Minor bump.~~ **DONE** |
| ~~`OpenTelemetry.Instrumentation.Http`~~ | ~~1.14.0~~ | ~~**1.15.0**~~ | ~~LOW~~ | ~~Minor bump.~~ **DONE** |
| ~~`OpenTelemetry.Instrumentation.Runtime`~~ | ~~1.14.0~~ | ~~**1.15.0**~~ | ~~LOW~~ | ~~Minor bump.~~ **DONE** |
| ~~`OpenTelemetry.Exporter.Prometheus.AspNetCore`~~ | ~~1.14.0-beta.1~~ | ~~**1.15.0-beta.1**~~ | ~~LOW~~ | ~~Beta bump. Also guarded `MapPrometheusScrapingEndpoint()` when SDK disabled.~~ **DONE** |
| ~~`OpenTelemetry.Instrumentation.GrpcNetClient`~~ | ~~1.14.0-beta.1~~ | ~~**1.15.0-beta.1**~~ | ~~LOW~~ | ~~Beta bump.~~ **DONE** |
| ~~`OpenTelemetry.Instrumentation.Process`~~ | ~~1.14.0-beta.2~~ | ~~**1.15.0-beta.1**~~ | ~~LOW~~ | ~~Beta bump.~~ **DONE** |
| ~~`Testcontainers.PostgreSql`~~ | ~~4.9.0~~ | ~~**4.10.0**~~ | ~~LOW~~ | ~~Minor bump.~~ **DONE** |
| ~~`Testcontainers.RabbitMq`~~ | ~~4.9.0~~ | ~~**4.10.0**~~ | ~~LOW~~ | ~~Minor bump.~~ **DONE** |
| ~~`Testcontainers.Redis` (Geo.Tests)~~ | ~~4.9.0~~ | ~~**4.10.0**~~ | ~~LOW~~ | ~~Minor bump.~~ **DONE** |
| ~~`Testcontainers.Redis` (Tests)~~ | ~~**4.8.1**~~ | ~~**4.10.0**~~ | ~~LOW~~ | ~~**Also fixes version inconsistency** — was 4.8.1 vs 4.9.0 in Geo.Tests.~~ **DONE** |
| ~~`xunit.v3`~~ | ~~3.2.0~~ | ~~**3.2.2**~~ | ~~NONE~~ | ~~Bug fix patches.~~ **DONE** |
| ~~`Microsoft.NET.Test.Sdk`~~ | ~~18.0.1~~ | ~~**18.3.0**~~ | ~~LOW~~ | ~~Minor bump.~~ **DONE** |
| ~~`JetBrains.Annotations`~~ | ~~2025.2.2~~ | ~~**2025.2.4**~~ | ~~NONE~~ | ~~Patch. Added code signing.~~ **DONE** |

### Tier 3 — Needs Investigation

| Package | Current | Latest | Risk | Notes |
| ------- | ------- | ------ | ---- | ----- |
| `dotenv.net` | 3.2.1 | **4.0.1** | MEDIUM | Major version. Multi-env file support, API may have changed. Test `DotEnv.Load()` calls. Consult [GitHub](https://github.com/bolorundurowb/dotenv.net) for migration details. |

### Already at Latest (no action)

| Package | Version |
| ------- | ------- |
| `FluentAssertions` | 8.8.0 |
| `FluentValidation` | 12.1.1 |
| `Moq` | 4.20.72 |
| `IPinfo` | 3.3.0 |
| `StyleCop.Analyzers` | 1.2.0-beta.556 |
| `Serilog.Enrichers.Environment` | 3.0.1 |
| `Serilog.Enrichers.Span` | 3.1.0 (deprecated upstream — plan removal) |
| `xunit.runner.visualstudio` | 3.1.5 |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 10.0.0 |

### .NET Notes

- **Serilog.Enrichers.Span** is deprecated. Serilog now natively supports span data logging. Consider removing in a future cleanup PR.
- **xunit.runner.visualstudio** may be droppable if exclusively using `dotnet test` with Microsoft Testing Platform (already have `UseMicrosoftTestingPlatformRunner=true`).

---

## Node.js Backend Packages

### Already at Latest (no action)

| Package | Version |
| ------- | ------- |
| `@hono/node-server` | 1.19.9 |
| `@grpc/grpc-js` | 1.14.3 |
| `@bufbuild/protobuf` | 2.11.0 |
| `@bufbuild/buf` | 1.65.0 |
| `ts-proto` | 2.11.2 |
| `rabbitmq-client` | 5.0.8 |
| `uuid` | 13.0.0 |
| `marked` | 17.0.3 |
| `tsx` | 4.21.0 |
| `typescript` | 5.9.3 |
| `prettier` | 3.8.1 |
| `drizzle-orm` | 0.45.1 (v1 beta exists — do NOT adopt) |

### Simple Bumps (zero risk)

| Package | Current | Latest | Notes |
| ------- | ------- | ------ | ----- |
| `hono` | 4.11.9 | **4.12.3** | Minor bump. Excellent backward compat. |
| `ioredis` | 5.8.0 | **5.10.0** | Minor bump within v5. |
| `pg` | 8.18.0 | **8.19.0** | Minor bump within v8. |
| `pino-pretty` | 13.0.0 | **13.1.3** | Minor bump. |
| `prettier-plugin-svelte` | 3.4.1 | **3.5.0** | Minor bump. |
| `typescript-eslint` | 8.54.0 | **8.56.1** | Minor bump. Supports ESLint 9 and 10. |

### Minor Breaking Changes (Node.js version gating)

| Package | Current | Latest | Risk | Notes |
| ------- | ------- | ------ | ---- | ----- |
| `pino` | 9.6.0 | **10.3.1** | LOW | Only breaking change: drops Node 18. We're on Node 22, so this is a simple bump. |
| `import-in-the-middle` | 1.14.4 | **3.0.0** | LOW | Internal CJS→ESM conversion. Public API unchanged. Verify OTel compatibility. |
| `isomorphic-dompurify` | 2.36.0 | **3.0.0** | MEDIUM | ESM named exports, jsdom now external. Remove `@types/dompurify` if present. New `clearWindow()` export useful for long-running comms service. Pin jsdom to 25.0.1 via overrides if jsdom@28 causes issues. |

### OpenTelemetry (coordinated upgrade)

All OTel packages should be upgraded together in `@d2/service-defaults`:

| Package | Current | Latest | Notes |
| ------- | ------- | ------ | ----- |
| `@opentelemetry/api` | 1.9.0 | **1.9.0** | Already latest. |
| `@opentelemetry/sdk-node` | 0.206.0 | **0.212.0** | Minor bump. |
| `@opentelemetry/sdk-metrics` | 2.1.0 | **2.5.0** | Minor bump. |
| `@opentelemetry/sdk-logs` | 0.206.0 | **0.208.0** | Minor bump. |
| `@opentelemetry/resources` | 2.1.0 | **2.5.1** | Minor bump. |
| `@opentelemetry/semantic-conventions` | 1.37.0 | **1.39.0** | Minor bump. |
| `@opentelemetry/auto-instrumentations-node` | 0.65.0 | **0.70.1** | Minor bump. |
| `@opentelemetry/exporter-*-otlp-http` | 0.206.0 | **0.212.0** | Minor bump. |
| `@opentelemetry/exporter-trace-otlp-proto` | 0.206.0 | **0.212.0** | Minor bump. |
| `@opentelemetry/instrumentation` | 0.206.0 | **0.212.0** | Minor bump. |
| `@opentelemetry/instrumentation-document-load` | 0.52.0 | — | Check npm for latest. |
| `@opentelemetry/instrumentation-fetch` | 0.206.0 | **0.212.0** | Minor bump. |
| `@opentelemetry/sdk-trace-web` | 2.1.0 | **2.5.0** | Minor bump. |

**Key changes since 0.206.0:** Environment variable config no longer auto-applied when instantiating SDK components directly (use `NodeSDK` instead — which D2-WORX already does via `@d2/service-defaults`). Verify `import-in-the-middle` v3 compatibility.

### Major Upgrades — Requires Planning

#### better-auth: 1.4.18 → 1.5.0

**Impact: LOW–MEDIUM.** Released 2026-02-28 (today). 600+ commits, 200+ bug fixes. D2-WORX is well-positioned — avoids almost all breaking changes.

**What's new (relevant to D2-WORX):**
- **`/update-session` endpoint** — update custom session fields without re-auth (useful for org context switching)
- **Non-destructive secret rotation** — multiple `BETTER_AUTH_SECRET` keys with versioning
- **Typed error codes** — machine-readable `code` field on all errors; `defineErrorCodes()` utility
- **SSO production-ready** — 23+ security commits, SAML SLO (not used yet, but available)
- **Stricter default rate limits** — sign-in/sign-up: 3/10s; reset/OTP: 3/60s
- **OTP reuse prevention** via atomic invalidation
- **User enumeration prevention** on sign-up with email verification
- **Dynamic `membershipLimit`** — org plugin now accepts a function (not just number)
- **Adapter extraction** — `drizzleAdapter` now available as `@better-auth/drizzle-adapter` (main package still re-exports for backward compat)
- **`@better-auth/cli` deprecated** — replaced by `npx auth` CLI

**Breaking changes — D2-WORX impact audit:**

| Breaking Change | D2-WORX Uses? | Impact | Action |
| --------------- | ------------- | ------ | ------ |
| `InferUser`/`InferSession` removed | No | None | — |
| `createAdapter` → `createAdapterFactory` | No (uses `drizzleAdapter`) | None | — |
| `@better-auth/core/utils` barrel removed | No | None | — |
| `getMigrations` moved | No (uses Drizzle migrations) | None | — |
| `permission` → `permissions` (org plugin) | Uses statement-based RBAC (correct API) | None | — |
| `advanced.database.useNumberId` removed | Not used | None | — |
| `Store` → `ClientStore` | Not used | None | — |
| `Adapter` → `DBAdapter` | Not used | None | — |
| API Key plugin extracted | Not used | None | — |
| `/forget-password/email-otp` removed | Not used | None | — |
| `better-auth/adapters/test` removed | Not used | None | — |
| `$ERROR_CODES` type change | Not used (uses `APIError` directly) | None | — |
| Session `id` removed from secondary storage | Not stored (abstracted via handlers) | None | — |
| "After" hooks now post-transaction | **Yes** — `session.create.after` | **Low** | Already fire-and-forget with `.catch()`. Timing change is actually safer. |

**Migration steps:**
1. Bump `better-auth` from `1.4.18` to `1.5.0` in `auth/infra/package.json`
2. Bump or remove `@better-auth/cli` (deprecated — replace with `npx auth` if CLI is needed, otherwise remove the devDep entirely since D2-WORX uses Drizzle's own migration system)
3. `pnpm install`
4. Run `pnpm vitest run --project auth-tests` — 865 tests
5. Specifically verify: sign-up flow, session creation, sign-in audit event recording (post-transaction hook timing), impersonation JWT, Redis secondary storage

**Recommendation:** Upgrade. D2-WORX's isolation of better-auth in `@d2/auth-infra` pays off here — zero deprecated API usage, and the only behavioral change (post-transaction hooks) is already handled safely. The security hardening alone (OTP reuse prevention, enumeration prevention, stricter rate limits) makes this worthwhile.

#### Zod: 3.25.76 → 4.3.6

**Impact: HIGH.** Used in every handler's `validateInput()` across all Node.js services.

Key breaking changes:
- `z.string().email()` / `.uuid()` / `.url()` → `z.email()`, `z.uuid()`, `z.url()`
- `z.uuid()` now enforces RFC 4122 (use `z.guid()` for v3 behavior)
- `z.record()` now requires two arguments
- `.strict()` / `.passthrough()` → `z.strictObject()` / `z.looseObject()`
- Error customization API overhauled: `message` → `error`
- `error.errors` → `error.issues`

**Migration path:** Codemod available at `zod-v3-to-v4`. Incremental migration possible via `import from "zod/v4"` subpath (available since 3.25.0). Web client already on 4.1.11.

**Recommendation:** Upgrade, but as a dedicated PR with careful schema audit. The codemod handles most cases. This also unifies the version split between backend (3.x) and web (4.x).

#### Vitest: 3.1.1 → 4.0.18

**Impact: HIGH.** 1400+ tests across 6 test projects.

Key breaking changes:
- `workspace` config → `projects` (rename `vitest.workspace.ts` to `projects` array in `vitest.config.ts`)
- Mock constructor behavior: `new Mock()` now constructs instances instead of calling `mock.apply`
- Coverage requires explicit include patterns
- `poolMatchGlobs` config removed
- Reporter API removals

**Migration path:** Migrate workspace config first, then run full test suite. Review any tests using `vi.fn()` with `new`. Must also upgrade `@vitest/coverage-v8` to 4.0.18 and `@vitest/browser` to 4.0.18 + install `@vitest/browser-playwright`.

**Recommendation:** Upgrade. The workspace rename is the biggest change — rest should be transparent. Do this as a dedicated PR.

#### ESLint: 9.39.2 → 10.0.2

**Impact: MEDIUM.** Already on flat config, so minimal actual changes.

Key breaking changes:
- Requires Node.js ≥ 20.19
- Config file lookup starts from linted file's directory (not CWD) — shouldn't affect monorepo with root config
- Legacy `.eslintrc` format fully removed (not used)

**Migration path:** Straightforward since D2-WORX already uses flat config. Bump `eslint` + `@eslint/js` together. `typescript-eslint` 8.56.1 already supports ESLint 10.

**Recommendation:** Upgrade. Low actual risk despite major version number.

#### Resend: 4.5.1 → 6.9.3

**Impact: MEDIUM.** Two major version jumps. Used in `@d2/comms-infra` as email provider.

**Migration path:** Review v5.0.0 and v6.0.0 changelogs on [GitHub](https://github.com/resend/resend-node/releases). The core `resend.emails.send()` API is likely stable but constructor options and response types may have changed.

**Recommendation:** Investigate changelog before upgrading. May require comms-infra changes.

#### Testcontainers: 10.18.0 → 11.12.0

**Impact: MEDIUM.** Used in all integration and E2E tests.

Key breaking changes:
- Drops older Node.js support (now requires Node ≥ 18 with native fetch)
- Container module APIs should be stable

**Migration path:** Bump all `testcontainers` and `@testcontainers/*` packages together. Run integration tests.

**Recommendation:** Upgrade. Node 22 satisfies all requirements. Run full integration test suite after bump.

### Hold (do not upgrade)

| Package | Current | Latest | Why Hold |
| ------- | ------- | ------ | -------- |
| `drizzle-orm` | 0.45.1 | 1.0.0-beta.2 | v1 beta is NOT stable. Major breaking changes (array API, migration folder structure, RQBv2). Stay on 0.45.1. |
| `drizzle-kit` | 0.31.9 | — | Match drizzle-orm. |

### Verify

| Package | Current | npm Latest | Notes |
| ------- | ------- | ---------- | ----- |
| `twilio` | 5.12.2 | 5.11.2? | Version in package.json appears newer than npm latest. Verify actual installed version — may be a pre-release or npm index lag. |

---

## Frontend / SvelteKit Packages

### Already at Latest (no action)

| Package | Version |
| ------- | ------- |
| `tailwindcss-motion` | 1.1.1 |
| `clsx` | 2.1.1 |
| `mdsvex` | 0.12.6 |
| `eslint-config-prettier` | 10.1.8 |
| `prettier-plugin-tailwindcss` | 0.7.2 |
| `@hono/node-server` | 1.19.9 |

### Simple Bumps (zero risk)

| Package | Current | Latest | Notes |
| ------- | ------- | ------ | ----- |
| `svelte` | 5.39.8 | **5.53.5** | Same major. Custom `<select>`, CSS parser exports, ShadowRootInit. All additive. |
| `@sveltejs/kit` | 2.43.8 | **2.53.4** | Same major. Adds Vite 8 support (not needed yet). |
| `@sveltejs/adapter-node` | 5.3.3 | **5.5.3** | Same major. Configurable Node server options. |
| `@sveltejs/vite-plugin-svelte` | 6.2.1 | **6.2.4** | Patch. |
| `vite` | 7.1.9 | **7.3.1** | Same major. Defer Vite 8 (beta). |
| `tailwindcss` + `@tailwindcss/vite` | 4.1.14 | **4.2.1** | New color palettes (additive), logical property utilities. |
| `tailwind-merge` | 3.3.1 | **3.5.0** | Minor. Supports Tailwind v4.0–v4.2. |
| `tailwind-variants` | 3.1.1 | **3.2.2** | Minor. |
| `@stripe/stripe-js` | 8.0.0 | **8.8.0** | Minor. |
| `@inlang/paraglide-js` | 2.4.0 | **2.13.0** | Minor. Rapid release cadence. |
| `humanize-duration` | 3.33.1 | **3.33.2** | Patch. |
| `libphonenumber-js` | 1.12.23 | **1.12.38** | Patches with updated phone metadata. |
| `postcode-validator` | 3.10.5 | **3.10.9** | Patches with updated validation rules. |
| `svelte-check` | 4.3.2 | **4.4.1** | Minor. |
| `eslint-plugin-svelte` | 3.14.0 | **3.15.0** | Minor. |

### Needs Attention

| Package | Current | Latest | Risk | Notes |
| ------- | ------- | ------ | ---- | ----- |
| `@playwright/test` + `playwright` | 1.55.1 | **1.58.0** | LOW | Removed `_react`/`_vue` selectors, `:light` suffix, `devtools` launch option. Search codebase for usage — likely none (Svelte project). Both packages must match versions. |

### Major Upgrade (with Vitest)

| Package | Current | Latest | Notes |
| ------- | ------- | ------ | ----- |
| `@vitest/browser` | 3.2.4 | **4.0.18** | Must upgrade with all Vitest packages. Requires `@vitest/browser-playwright` provider package. |
| `vitest-browser-svelte` | 1.1.0 | **2.0.2** | Requires Vitest 4.0.0+. |

---

## Container Images

### Simple Bumps (patch releases, volumes preserved)

| Image | Current | Latest | Notes |
| ----- | ------- | ------ | ----- |
| `postgres` | 18.0-trixie | **18.3-trixie** | Patch. Already on 18.x so PGDATA path is stable. Bug fixes including function stability corrections. |
| `grafana/grafana` | 12.2.0 | **12.4.0** | Minor. Auto-migrates dashboard schemas. |
| `grafana/mimir` | 2.17.1 | **2.17.7** | Patch with CVE fix for `go.opentelemetry.io/otel/sdk`. |
| `grafana/alloy` | v1.11.0 | **v1.13.2** | Minor. Stateless collector — no volume concerns. |
| `gcr.io/cadvisor/cadvisor` | v0.50.0 | **v0.56.2** | Minor. Stateless. Lock contention + race fixes. |
| `dpage/pgadmin4` | 9.8.0 | **9.12** | Minor. SQLite config preserved. |
| `prometheuscommunity/postgres-exporter` | v0.18.1 | **v0.19.1** | Minor. Stateless. |
| `oliver006/redis_exporter` | v1.78.0 | **v1.80.1** | Minor. Stateless. |

### Moderate Risk (minor breaking changes)

| Image | Current | Latest | Risk | Notes |
| ----- | ------- | ------ | ---- | ----- |
| `redis` | 8.2.1-bookworm | **8.2.4-bookworm** (conservative) or **8.6.1** (aggressive) | LOW | 8.2.4 is patch-only. 8.6.1 fixes a SCAN filter order regression from 8.2. Volumes auto-migrate within 8.x. As a caching layer, risk is low. |
| `rabbitmq` | 4.1.4-management | **4.1.7-management** (conservative) or **4.2.4-management** (moderate) | LOW | 4.1.7 is patch-only. 4.2 replaces Raft metrics subsystem — update Grafana dashboards if monitoring `rabbitmq_raft` metrics. Volumes preserved. |
| `grafana/loki` | 3.5.5 | **3.5.10** (conservative) or **3.6.7** (moderate) | LOW | 3.5.10 is patch-only. 3.6 removes embedded Loki UI (moved to Grafana plugin) — not relevant if using Grafana for visualization. |
| `grafana/tempo` | 2.8.2 | **2.10.1** | MEDIUM | vParquet2 encoding fully removed in 2.10. If using default settings (not pinned to vParquet2), upgrade directly. Otherwise, first run 2.9.x with vParquet3+ until blocks expire. |

### Requires Separate Planning

| Image | Current | Latest | Risk | Notes |
| ----- | ------- | ------ | ---- | ----- |
| `redis/redisinsight` | 2.70.1 | **3.2.0** | MEDIUM | Major version. New UI + internal storage changes. Server configs may need re-entry. Test in fresh instance first. Alternatively, stay on 2.70.1 (still works). |
| `minio/minio` | RELEASE.2025-09-07 | **ARCHIVED** | HIGH | MinIO's GitHub repo was archived 2026-02-13. No new releases. Docker Hub images pulled. Current pinned images continue to work. **Evaluate alternatives:** Garage (AGPLv3), RustFS (Apache 2.0, 2.3x faster for small objects), SeaweedFS (Apache 2.0, mature). Track as separate migration effort. |
| `minio/mc` | RELEASE.2025-08-13 | **ARCHIVED** | — | Same situation as MinIO server. |

### Already at Latest

| Image | Version |
| ----- | ------- |
| `dkron/dkron` | 4.0.9 (no new releases since Dec 2025) |

---

## Upgrade Plan

### ~~Step 1 — Platform Runtimes + Security Patches~~ DONE

**Effort: ~30 min. Risk: None. Commit separately.**

~~Update the core platform tooling first — everything else depends on these.~~

| # | Action | Details | Status |
| - | ------ | ------- | ------ |
| ~~1a~~ | ~~Install .NET SDK 10.0.103~~ | ~~Download from dotnet.microsoft.com. Fixes **CVE-2026-21218**.~~ | ~~DONE~~ |
| ~~1b~~ | ~~Add `global.json` at project root~~ | ~~Pin SDK version: `{ "sdk": { "version": "10.0.103" } }`. Prevents implicit SDK drift.~~ | ~~DONE~~ |
| ~~1c~~ | ~~Install Node.js 24.14.0~~ | ~~Via nvm/fnm or direct download. Current LTS.~~ | ~~DONE~~ |
| ~~1d~~ | ~~Update `engines.node` in root `package.json`~~ | ~~`>=22.0.0` → `>=24.0.0` (Node 22 is EOL since Jan 2026).~~ | ~~DONE~~ |
| ~~1e~~ | ~~Update pnpm to 10.30.3~~ | ~~`corepack prepare pnpm@10.30.3 --activate`~~ | ~~DONE~~ |
| ~~1f~~ | ~~Update `engines.pnpm` in root `package.json`~~ | ~~`>=10.0.0` → `>=10.15.0`.~~ | ~~DONE~~ |
| ~~1g~~ | ~~`pnpm install`~~ | ~~Regenerate lockfile with new pnpm version.~~ | ~~DONE~~ |

**Validation:** ~~`dotnet --version` → 10.0.103. `node -v` → v24.14.0. `pnpm -v` → 10.30.3. `pnpm install` succeeds.~~ **All verified.** Committed as `e7e68892`.

---

### ~~Step 2 — .NET Pre-release Cleanup + Servicing Patches~~ DONE

**Effort: ~1 hour. Risk: None. Commit separately.**

~~Fix pre-release packages on GA products and apply all .NET servicing patches. Edit `.csproj` files directly.~~

| # | Action | Files to Edit | Status |
| - | ------ | ------------- | ------ |
| ~~2a~~ | ~~`Microsoft.Extensions.Caching.Memory` 10.0.0-rc.2 → **10.0.3**~~ | ~~`InMemoryCache.Default.csproj`~~ | ~~DONE~~ |
| ~~2b~~ | ~~`Grpc.AspNetCore` 2.76.0-pre1 → **2.76.0**~~ | ~~`Geo.API.csproj`~~ | ~~DONE~~ |
| ~~2c~~ | ~~`Grpc.Net.Client` 2.76.0-pre1 → **2.76.0**~~ | ~~`Protos.DotNet.csproj`~~ | ~~DONE~~ |
| ~~2d~~ | ~~`Grpc.Net.ClientFactory` 2.76.0-pre1 → **2.76.0**~~ | ~~`REST.csproj`, `Geo.Client.csproj`~~ | ~~DONE~~ |
| ~~2e~~ | ~~`CommunityToolkit.Aspire.Hosting.JavaScript.Extensions` beta → **13.1.1**~~ | ~~`AppHost.csproj`~~ | ~~DONE~~ |
| ~~2f~~ | ~~All `Aspire.*` packages 13.0.0 → **13.1.2**~~ | ~~`AppHost.csproj`, `ServiceDefaults.csproj`~~ | ~~DONE~~ |
| ~~2f+~~ | ~~`Aspire.Hosting.Testing` 13.0.0 → **13.1.2**~~ | ~~`Tests.csproj`, `Geo.Tests.csproj`~~ | ~~DONE~~ |
| ~~2g~~ | ~~All `Microsoft.EntityFrameworkCore.*` → **10.0.3**~~ | — | ~~HELD~~ — `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.0 pins EF Core Relational to 10.0.0. Bumping EF Core causes assembly version conflict. Stay at 10.0.0 until Npgsql EF provider releases 10.0.x. |
| ~~2h~~ | ~~All `Microsoft.AspNetCore.*` → **10.0.3**~~ | ~~`REST.csproj`~~ | ~~DONE~~ |
| ~~2i~~ | ~~All `Microsoft.Extensions.*` → **10.0.3** / **10.3.0**~~ | ~~Multiple shared `.csproj` files~~ | ~~DONE~~ |
| ~~2j~~ | ~~`Npgsql` 10.0.0 → **10.0.1**~~ | ~~`Errors.Pg.csproj`~~ | ~~DONE~~ |
| ~~2k~~ | ~~Fix `Testcontainers.Redis` inconsistency + all `Testcontainers.*` → **4.10.0**~~ | ~~`Tests.csproj` (was 4.8.1), `Geo.Tests.csproj`~~ | ~~DONE~~ |
| ~~2l~~ | ~~`xunit.v3` → **3.2.2**, `Microsoft.NET.Test.Sdk` → **18.3.0**~~ | ~~`Geo.Tests.csproj`, `Tests.csproj`~~ | ~~DONE~~ |
| ~~2m~~ | ~~`JetBrains.Annotations` → **2025.2.4**~~ | ~~`Utilities.csproj`, `Geo.Tests.csproj`, `Tests.csproj`~~ | ~~DONE~~ |

**Validation:** ~~`dotnet build D2.sln` succeeds. `dotnet test` passes.~~ **All verified.** Build: 0 warnings, 0 errors. Tests: 1,528 passed (798 Geo + 730 Shared).

---

### ~~Step 3 — .NET Library Bumps (minor versions)~~ DONE

**Effort: ~1 hour. Risk: Low. Commit separately.**

| # | Action | Notes | Status |
| - | ------ | ----- | ------ |
| ~~3a~~ | ~~`StackExchange.Redis` 2.9.32 → **2.11.8**~~ | ~~`StringSetAsync` overload changed `TimeSpan?` → `Expiration` struct. Fixed `Set.cs`, `SetNx.cs` with pattern match (`is { } ttl ? ttl : Expiration.Default`). `AcquireLock.cs` used implicit `TimeSpan` → `Expiration` conversion.~~ | ~~DONE~~ |
| ~~3b~~ | ~~`RabbitMQ.Client` 7.1.2 → **7.2.1**~~ | ~~Better disposable handling.~~ | ~~DONE~~ |
| ~~3c~~ | ~~`Grpc.Tools` 2.76.0 → **2.78.0**~~ | ~~Proto compiler update.~~ | ~~DONE~~ |
| ~~3d~~ | ~~`Google.Protobuf` 3.33.1 → **3.34.0**~~ | ~~Compatible with Grpc.Tools 2.78.0.~~ | ~~DONE~~ |
| ~~3e~~ | ~~Regenerate .NET protos~~ | ~~Rebuilt `Protos.DotNet` — clean.~~ | ~~DONE~~ |
| ~~3f~~ | ~~All `OpenTelemetry.*` → **1.15.0** / **1.15.0-beta.1**~~ | ~~**Breaking:** `OTEL_SDK_DISABLED=true` causes NullRefException in `OpenTelemetryMetricsListener` + `PrometheusExporterMiddleware`. Fixed by guarding `ConfigureOpenTelemetry()` and `MapPrometheusEndpointWithIpRestriction()` with env var check.~~ | ~~DONE~~ |
| ~~3g~~ | ~~`Serilog.AspNetCore` 9.0.0 → **10.0.0**~~ | ~~Major version number aligns with .NET 10 — not an API overhaul.~~ | ~~DONE~~ |
| ~~3h~~ | ~~`Serilog.Enrichers.ClientInfo` 2.6.0 → **2.9.0**~~ | ~~Minor bump.~~ | ~~DONE~~ |
| ~~3i~~ | ~~`Serilog.Sinks.Grafana.Loki` 8.3.1 → **8.3.2**~~ | ~~Bug fix.~~ | ~~DONE~~ |
| ~~3j~~ | ~~Testcontainers deprecated constructor fix~~ | ~~Migrated all 10 parameterless `new XxxBuilder().WithImage(...)` to `new XxxBuilder("image")` constructor pattern (Testcontainers 4.10.0 deprecation). Eliminated all 10 CS0618 warnings.~~ | ~~DONE~~ |
| ~~3k~~ | ~~Aspire 13.1 Redis TLS fix~~ | ~~`AddRedis` now enables TLS by default — plaintext clients get SSL errors. Added `.WithoutHttpsCertificate()` to Redis resource in AppHost.cs. Suppressed experimental API diagnostic `ASPIRECERTIFICATES001` in AppHost.csproj.~~ | ~~DONE~~ |

**Validation:** ~~`dotnet build D2.sln` succeeds. `dotnet test` passes. Verify OTel traces appear in Grafana.~~ **All verified.** Build: 0 warnings, 0 errors. Tests: 1,528 .NET passed (798 Geo + 730 Shared). E2E: 12 passed (6 test files). Redis TLS fix confirmed working.

---

### ~~Step 4 — Node.js Backend Bumps (including better-auth 1.5)~~ DONE

**Effort: ~1 hour. Risk: Low. Commit separately.**

Update `package.json` files with exact pinned versions, then `pnpm install`.

| # | Package | Version | Files | Status |
| - | ------- | ------- | ----- | ------ |
| ~~4a~~ | ~~`better-auth`~~ | ~~→ **1.5.0**~~ | ~~`auth/infra/package.json`~~ | ~~DONE~~ |
| ~~4b~~ | ~~`@better-auth/cli`~~ | ~~**Remove** (deprecated — replaced by `npx auth`)~~ | ~~`auth/infra/package.json` devDeps~~ | ~~DONE~~ |
| ~~4c~~ | ~~`hono`~~ | ~~→ **4.12.3**~~ | ~~`auth/api/package.json`~~ | ~~DONE~~ |
| ~~4d~~ | ~~`ioredis`~~ | ~~→ **5.10.0**~~ | ~~`cache-redis/package.json`, `auth/api/package.json`, `comms/api/package.json`~~ | ~~DONE~~ |
| ~~4e~~ | ~~`pg`~~ | ~~→ **8.19.0**~~ | ~~`auth/infra/package.json`, `auth/api/package.json`, `comms/infra/package.json`, `comms/api/package.json`~~ | ~~DONE~~ |
| ~~4f~~ | ~~`pino-pretty`~~ | ~~→ **13.1.3**~~ | ~~`logging/package.json`~~ | ~~DONE~~ |
| ~~4g~~ | ~~`prettier-plugin-svelte`~~ | ~~→ **3.5.0**~~ | ~~Root `package.json`~~ | ~~DONE~~ |
| ~~4h~~ | ~~`typescript-eslint`~~ | ~~→ **8.56.1**~~ | ~~Root `package.json`~~ | ~~DONE~~ |

**better-auth 1.5 specific validation:**
- ~~`pnpm vitest run --project auth-tests` — all 865 tests pass~~ **Confirmed** — 865 tests pass
- Verify sign-up flow (Geo contact creation in `user.create.before` hook)
- Verify sign-in audit event recording (`session.create.after` — now fires post-transaction, but already fire-and-forget)
- Verify Redis secondary storage session reads/writes
- Verify impersonation JWT payload generation

**General validation:** ~~`pnpm install` succeeds. `pnpm vitest run` passes (all 1400+ unit tests).~~ **All verified.** Build: all 36 packages clean. Tests: 2,534 passed (973 shared + 865 auth + 553 comms + 64 dkron-mgr + 79 e2e-adjacent). 3 RabbitMQ container startup timeouts on first run (Docker flakiness, pass on retry).

---

### ~~Step 5 — Frontend Simple Bumps~~ DONE

**Effort: ~30 min. Risk: None. Commit separately.**

All in `clients/web/package.json`:

| # | Package | Version | Status |
| - | ------- | ------- | ------ |
| ~~5a~~ | ~~`svelte`~~ | ~~→ **5.53.5**~~ | ~~DONE~~ |
| ~~5b~~ | ~~`@sveltejs/kit`~~ | ~~→ **2.53.3**~~ | ~~DONE~~ |
| ~~5c~~ | ~~`@sveltejs/adapter-node`~~ | ~~→ **5.5.3**~~ | ~~DONE~~ |
| ~~5d~~ | ~~`@sveltejs/vite-plugin-svelte`~~ | ~~→ **6.2.4**~~ | ~~DONE~~ |
| ~~5e~~ | ~~`vite`~~ | ~~→ **7.3.1**~~ | ~~DONE~~ |
| ~~5f~~ | ~~`tailwindcss` + `@tailwindcss/vite`~~ | ~~→ **4.2.1**~~ | ~~DONE~~ |
| ~~5g~~ | ~~`tailwind-merge`~~ | ~~→ **3.5.0**~~ | ~~DONE~~ |
| ~~5h~~ | ~~`tailwind-variants`~~ | ~~→ **3.2.2**~~ | ~~DONE~~ |
| ~~5i~~ | ~~`@stripe/stripe-js`~~ | ~~→ **8.8.0**~~ | ~~DONE~~ |
| ~~5j~~ | ~~`@inlang/paraglide-js`~~ | ~~→ **2.13.0**~~ | ~~DONE~~ |
| ~~5k~~ | ~~`humanize-duration`~~ | ~~→ **3.33.2**~~ | ~~DONE~~ |
| ~~5l~~ | ~~`libphonenumber-js`~~ | ~~→ **1.12.38**~~ | ~~DONE~~ |
| ~~5m~~ | ~~`postcode-validator`~~ | ~~→ **3.10.9**~~ | ~~DONE~~ |
| ~~5n~~ | ~~`svelte-check`~~ | ~~→ **4.4.1**~~ | ~~DONE~~ |
| ~~5o~~ | ~~`eslint-plugin-svelte`~~ | ~~→ **3.15.0**~~ | ~~DONE~~ |
| ~~5p~~ | ~~`@playwright/test` + `playwright`~~ | ~~→ **1.58.0**~~ | ~~DONE~~ |
| ~~5q~~ | ~~`vitest` + `@vitest/coverage-v8`~~ | ~~→ **3.2.4** (all workspaces)~~ | ~~DONE — required by vite 7.3.1 (vitest 3.1.1 pulled vite 6.4.1, causing duplicate vite type conflicts in svelte-check)~~ |
| ~~5r~~ | ~~`pnpm.overrides` for `vite`~~ | ~~→ **7.3.1** (workspace-wide)~~ | ~~DONE — vitest 3.2.4 was still resolving a second vite copy without the override~~ |

**Validation:** ~~`pnpm install`. `pnpm -C clients/web build` succeeds. `svelte-check` passes.~~ **All verified.** Build clean. svelte-check: 0 errors, 0 warnings. All 2,551 tests pass.

---

### ~~Step 6 — Container Image Bumps~~ DONE

**Effort: ~1 hour. Risk: Low. Commit separately.**

All changes in `backends/dotnet/orchestration/AppHost/AppHost.cs` (container image tags).

| # | Image | Current → Target | Notes | Status |
| - | ----- | ----------------- | ----- | ------ |
| ~~6a~~ | ~~`postgres`~~ | ~~18.0-trixie → **18.3-trixie**~~ | ~~Patch. Volumes preserved.~~ | ~~DONE~~ |
| ~~6b~~ | ~~`redis`~~ | ~~8.2.1-bookworm → **8.2.4-bookworm**~~ | ~~Patch.~~ | ~~DONE~~ |
| ~~6c~~ | ~~`rabbitmq`~~ | ~~4.1.4-management → **4.1.7-management**~~ | ~~Patch.~~ | ~~DONE~~ |
| ~~6d~~ | ~~`grafana/grafana`~~ | ~~12.2.0 → **12.4.0**~~ | ~~Auto-migrates dashboards.~~ | ~~DONE~~ |
| ~~6e~~ | ~~`grafana/loki`~~ | ~~3.5.5 → **3.5.10**~~ | ~~Patch.~~ | ~~DONE~~ |
| ~~6f~~ | ~~`grafana/tempo`~~ | ~~2.8.2 → **2.10.1**~~ | ~~Minor bump.~~ | ~~DONE~~ |
| ~~6g~~ | ~~`grafana/mimir`~~ | ~~2.17.1 → **2.17.7**~~ | ~~Patch with CVE fix.~~ | ~~DONE~~ |
| ~~6h~~ | ~~`grafana/alloy`~~ | ~~v1.11.0 → **v1.13.2**~~ | ~~Stateless collector.~~ | ~~DONE~~ |
| ~~6i~~ | ~~`cadvisor`~~ | ~~v0.50.0 → **v0.56.2**~~ | ~~Stateless.~~ | ~~DONE~~ |
| ~~6j~~ | ~~`pgadmin4`~~ | ~~9.8.0 → **9.12**~~ | ~~SQLite config preserved.~~ | ~~DONE~~ |
| ~~6k~~ | ~~`postgres-exporter`~~ | ~~v0.18.1 → **v0.19.1**~~ | ~~Stateless.~~ | ~~DONE~~ |
| ~~6l~~ | ~~`redis_exporter`~~ | ~~v1.78.0 → **v1.80.1**~~ | ~~Stateless.~~ | ~~DONE~~ |

Testcontainers image tags use major version tags (`postgres:18`, `redis:8.2`, `rabbitmq:4.1-management`) — already match new patch versions, no changes needed.

**Validation:** ~~`dotnet aspire run` — verify all containers start. Check Grafana dashboards load. Check PostgreSQL connectivity.~~ Build verified clean. Container startup to be validated during manual testing.

---

### ~~Step 7 — Coordinated Node.js OTel Upgrade~~ DONE

**Effort: ~2 hours. Risk: Medium. Commit separately.**

Upgrade all `@opentelemetry/*` packages together. These span `@d2/service-defaults` and `clients/web`.

| # | Package | Current → Target | Status |
| - | ------- | ---------------- | ------ |
| ~~7a~~ | ~~`@opentelemetry/sdk-node`~~ | ~~0.206.0 → **0.212.0**~~ | ~~DONE~~ |
| ~~7b~~ | ~~`@opentelemetry/sdk-metrics`~~ | ~~2.1.0 → **2.5.0**~~ | ~~DONE~~ |
| ~~7c~~ | ~~`@opentelemetry/sdk-logs`~~ | ~~0.206.0 → **0.208.0**~~ | ~~DONE~~ |
| ~~7d~~ | ~~`@opentelemetry/resources`~~ | ~~2.1.0 → **2.5.1**~~ | ~~DONE~~ |
| ~~7e~~ | ~~`@opentelemetry/semantic-conventions`~~ | ~~1.37.0 → **1.39.0**~~ | ~~DONE~~ |
| ~~7f~~ | ~~`@opentelemetry/auto-instrumentations-node`~~ | ~~0.65.0 → **0.70.1**~~ | ~~DONE~~ |
| ~~7g~~ | ~~`@opentelemetry/exporter-*-otlp-http` (3 packages)~~ | ~~0.206.0 → **0.212.0**~~ | ~~DONE~~ |
| ~~7h~~ | ~~`@opentelemetry/exporter-trace-otlp-proto`~~ | ~~0.206.0 → **0.212.0**~~ | ~~DONE~~ |
| ~~7i~~ | ~~`@opentelemetry/instrumentation`~~ | ~~0.206.0 → **0.212.0**~~ | ~~DONE~~ |
| ~~7j~~ | ~~`@opentelemetry/instrumentation-fetch`~~ | ~~0.206.0 → **0.212.0**~~ | ~~DONE~~ |
| ~~7k~~ | ~~`@opentelemetry/sdk-trace-web`~~ | ~~2.1.0 → **2.5.0**~~ | ~~DONE~~ |
| ~~7l~~ | ~~`@opentelemetry/api-logs`~~ | ~~0.206.0 → **0.208.0**~~ | ~~DONE~~ |

**Note:** `@opentelemetry/api` stays at 1.9.0 (already latest).

**Validation:** ~~Start auth + comms services. Verify OTel traces flow to Alloy → Tempo → Grafana. Check metrics in Mimir. Run unit tests.~~ **All verified.** Build clean (all packages + web client). Tests: 2,551 passed. OTel trace flow to be confirmed during manual testing.

---

### ~~Step 8 — Node.js Minor Breaking Changes~~ DONE

**Effort: ~2 hours. Risk: Medium. Commit separately.**

| # | Package | Current → Target | Migration Notes | Status |
| - | ------- | ---------------- | --------------- | ------ |
| ~~8a~~ | ~~`pino`~~ | ~~9.6.0 → **10.3.1**~~ | ~~Log method signatures tightened. Fixed PinoLogger to use merging-object pattern `(obj, msg)` when args present.~~ | ~~DONE~~ |
| ~~8b~~ | ~~`import-in-the-middle`~~ | ~~1.14.4 → **3.0.0**~~ | ~~Internal CJS→ESM. Public API unchanged.~~ | ~~DONE~~ |
| ~~8c~~ | ~~`isomorphic-dompurify`~~ | ~~2.36.0 → **3.0.0**~~ | ~~Default import still works. No `@types/dompurify` to remove.~~ | ~~DONE~~ |
| ~~8d~~ | ~~`testcontainers` + all `@testcontainers/*`~~ | ~~10.18.0 → **11.12.0**~~ | ~~All integration tests pass (12 files using containers).~~ | ~~DONE~~ |
| ~~8e~~ | ~~`eslint` + `@eslint/js`~~ | ~~9.39.2 → **10.0.2** / **10.0.1**~~ | ~~Flat config works unchanged. 1 stale eslint-disable warning (non-blocking).~~ | ~~DONE~~ |

**Validation:** ~~`pnpm install`. `pnpm vitest run`. `pnpm vitest run --project auth-tests`. Lint check: `pnpm eslint .`.~~ **All verified.** Build clean. Tests: 2,551 passed. ESLint 10: 0 errors, 1 warning.

---

### Step 9 — Major Upgrade: Vitest 4.0 (separate PR)

**Effort: ~4 hours. Risk: High.**

This touches every test project in the monorepo.

| # | Action | Details |
| - | ------ | ------- |
| 9a | Rename `vitest.workspace.ts` | Migrate to `projects` array in `vitest.config.ts` (or rename key from `workspace` to `projects`). |
| 9b | Bump `vitest` to **4.0.18** | Root `package.json` and all test project `package.json` files. |
| 9c | Bump `@vitest/coverage-v8` to **4.0.18** | Root `package.json`. |
| 9d | Bump `@vitest/browser` to **4.0.18** | `clients/web/package.json`. |
| 9e | Install `@vitest/browser-playwright` | New required provider package for browser tests. |
| 9f | Bump `vitest-browser-svelte` to **2.0.2** | `clients/web/package.json`. |
| 9g | Review mock constructors | Search for `vi.fn()` used with `new` — behavior changed (now constructs instances). |
| 9h | Review coverage config | May need explicit `include` patterns. |
| 9i | Run full test suite | All 1400+ tests must pass. |

**Validation:** `pnpm vitest run` — all tests green. Coverage report generates correctly.

---

### Step 10 — Major Upgrade: Zod 4 (separate PR)

**Effort: ~6 hours. Risk: High.**

Unifies backend (3.25.76) and web (4.1.11) on Zod 4.3.6.

| # | Action | Details |
| - | ------ | ------- |
| 10a | Run codemod | `npx zod-v3-to-v4` on all backend packages. Handles most mechanical changes. |
| 10b | Manual schema audit | `z.string().email()` → `z.email()`, `z.string().uuid()` → `z.uuid()` or `z.guid()`. |
| 10c | Fix `z.record()` calls | Now requires two args (key schema + value schema). |
| 10d | Fix `.strict()` / `.passthrough()` | → `z.strictObject()` / `z.looseObject()`. |
| 10e | Fix error customization | `message` param → `error` param in schema methods. |
| 10f | Fix `error.errors` | → `error.issues` (if accessed in error handling). |
| 10g | Bump all backend `zod` to **4.3.6** | 7 package.json files. |
| 10h | Bump web `zod` to **4.3.6** | `clients/web/package.json` (from 4.1.11). |
| 10i | Run full test suite | All handler tests validate schema behavior. |

**Validation:** `pnpm vitest run` — all tests green. `pnpm tsc --noEmit` across all packages.

---

### Step 11 — Major Upgrade: Resend 6.x (separate PR)

**Effort: ~2 hours. Risk: Medium.**

| # | Action | Details |
| - | ------ | ------- |
| 11a | Review v5.0.0 changelog | Check [GitHub releases](https://github.com/resend/resend-node/releases) for API changes. |
| 11b | Review v6.0.0 changelog | Same. |
| 11c | Bump `resend` to **6.9.3** | `comms/infra/package.json`. |
| 11d | Update `@d2/comms-infra` email provider | Fix any constructor / response type changes. |
| 11e | Run comms tests | Unit + integration tests for email delivery. |

**Validation:** `pnpm vitest run --project comms-tests`. E2E verification email test passes.

---

### Deferred / Separate Efforts (not part of Q1 bump)

| Item | Priority | Reason to Defer |
| ---- | -------- | --------------- |
| **MinIO replacement** | Medium | Project archived Feb 2026. Current pinned images work. Evaluate Garage (AGPLv3), RustFS (Apache 2.0, 2.3x faster for small objects), or SeaweedFS (Apache 2.0, mature). Track as a separate initiative — this is an architecture decision, not a version bump. |
| **Mimir 3.0** | Low | Major architectural change: Kafka buffer, new MQE query engine, config restructuring, Consul/etcd deprecated. Requires deploying second cluster and migrating. Dedicated sprint. Stay on 2.17.7. |
| **RedisInsight 3.x** | Low | Dev tool only. Major version with new UI + storage changes. Test in fresh instance first. Low urgency — 2.70.1 still works. |
| **Drizzle ORM v1** | Hold | Beta only (1.0.0-beta.2). Major breaking changes (array API, migration folder structure, RQBv2). Not production-ready. Stay on 0.45.1. |
| **Vite 8** | Hold | Beta. SvelteKit 2.53+ supports it, but uses Rolldown bundler (Rust-based, replaces esbuild+Rollup). Wait for stable release. |
| **dotenv.net 4.0** | Low | Major version with potential API changes. Only used in .NET Utilities for env loading. Low priority — investigate when time permits. |
| **Serilog.Enrichers.Span removal** | Low | Deprecated upstream — Serilog now natively supports span data. Low priority cleanup. |
| **TypeScript 6.0** | Hold | Beta announced. Not stable. Stay on 5.9.3. |
| **pnpm 11** | Hold | Alpha (v11.0.0-alpha.11). Not production-ready. MessagePack storage, pure ESM, YAML config. Stay on 10.x. |
| **.NET 11** | Hold | Preview 1 only. STS release (not LTS). Stay on .NET 10 LTS. |

---

### Upgrade Summary by PR

| PR | Steps | Scope | Risk | Estimated Effort | Status |
| -- | ----- | ----- | ---- | ---------------- | ------ |
| PR 1 | Steps 1–6 | Platform + all safe bumps (incl. better-auth 1.5) + containers | None–Low | ~5 hours | **IN PROGRESS** (Step 1 done, Aspire done, Step 2 remaining items next) |
| PR 2 | Step 7 | Node.js OTel upgrade | Medium | ~2 hours | |
| PR 3 | Step 8 | Node.js minor breaking changes | Medium | ~2 hours | |
| PR 4 | Step 9 | Vitest 4.0 | High | ~4 hours | |
| PR 5 | Step 10 | Zod 4 unification | High | ~6 hours | |
| PR 6 | Step 11 | Resend 6.x | Medium | ~2 hours | |

Steps 1–6 can be a single large PR (all safe, mechanical changes) or split into smaller PRs per step if preferred. Steps 7+ should each be their own PR due to increasing risk. Note: better-auth 1.5 is included in PR 1 because D2-WORX's codebase avoids all breaking changes — the auth test suite (865 tests) provides strong coverage for validation.

---

## Appendix A: Full .NET Package Inventory

<details>
<summary>Click to expand</summary>

| Package | Current | Latest | Projects | Status |
| ------- | ------- | ------ | -------- | ------ |
| ~~Aspire.Hosting~~ | ~~13.0.0~~ | ~~13.1.2~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~Aspire.Hosting.AppHost~~ | ~~13.0.0~~ | ~~13.1.2~~ | ~~AppHost~~ | ~~DONE~~ |
| ~~Aspire.Hosting.JavaScript~~ | ~~13.0.0~~ | ~~13.1.2~~ | ~~AppHost~~ | ~~DONE~~ |
| ~~Aspire.Hosting.PostgreSQL~~ | ~~13.0.0~~ | ~~13.1.2~~ | ~~AppHost~~ | ~~DONE~~ |
| ~~Aspire.Hosting.RabbitMQ~~ | ~~13.0.0~~ | ~~13.1.2~~ | ~~AppHost~~ | ~~DONE~~ |
| ~~Aspire.Hosting.Redis~~ | ~~13.0.0~~ | ~~13.1.2~~ | ~~AppHost~~ | ~~DONE~~ |
| ~~Aspire.Hosting.Testing~~ | ~~13.0.0~~ | ~~13.1.2~~ | ~~Geo.Tests, Tests~~ | ~~DONE~~ |
| ~~CommunityToolkit.Aspire.Hosting.JavaScript.Extensions~~ | ~~13.0.0-beta.444~~ | ~~13.1.1~~ | ~~AppHost~~ | ~~DONE~~ |
| dotenv.net | 3.2.1 | 4.0.1 | Utilities |
| FluentAssertions | 8.8.0 | 8.8.0 | Geo.Tests, Tests |
| FluentValidation | 12.1.1 | 12.1.1 | Handler |
| ~~Google.Protobuf~~ | ~~3.33.1~~ | ~~3.34.0~~ | ~~Messaging.RabbitMQ, Protos.DotNet~~ | ~~DONE~~ |
| ~~Grpc.AspNetCore~~ | ~~2.76.0-pre1~~ | ~~2.76.0~~ | ~~Geo.API~~ | ~~DONE~~ |
| ~~Grpc.Net.Client~~ | ~~2.76.0-pre1~~ | ~~2.76.0~~ | ~~Protos.DotNet~~ | ~~DONE~~ |
| ~~Grpc.Net.ClientFactory~~ | ~~2.76.0-pre1~~ | ~~2.76.0~~ | ~~REST, Geo.Client~~ | ~~DONE~~ |
| ~~Grpc.Tools~~ | ~~2.76.0~~ | ~~2.78.0~~ | ~~Protos.DotNet~~ | ~~DONE~~ |
| IPinfo | 3.3.0 | 3.3.0 | Geo.Infra |
| ~~JetBrains.Annotations~~ | ~~2025.2.2~~ | ~~2025.2.4~~ | ~~Utilities, Geo.Tests, Tests~~ | ~~DONE~~ |
| ~~Microsoft.AspNetCore.Authentication.JwtBearer~~ | ~~10.0.0~~ | ~~10.0.3~~ | ~~REST~~ | ~~DONE~~ |
| ~~Microsoft.AspNetCore.OpenApi~~ | ~~10.0.0~~ | ~~10.0.3~~ | ~~REST~~ | ~~DONE~~ |
| Microsoft.EntityFrameworkCore | 10.0.0 | 10.0.3 | Geo.Infra, Batch.Pg, Transactions.Pg | HELD |
| Microsoft.EntityFrameworkCore.Design | 10.0.0 | 10.0.3 | Geo.Infra | HELD |
| Microsoft.EntityFrameworkCore.InMemory | 10.0.0 | 10.0.3 | Tests | HELD |
| ~~Microsoft.Extensions.Caching.Memory~~ | ~~10.0.0-rc.2~~ | ~~10.0.3~~ | ~~InMemoryCache.Default~~ | ~~DONE~~ |
| ~~Microsoft.Extensions.Configuration~~ | ~~10.0.0~~ | ~~10.0.3~~ | ~~Geo.Client~~ | ~~DONE~~ |
| ~~Microsoft.Extensions.DependencyInjection.Abstractions~~ | ~~10.0.0~~ | ~~10.0.3~~ | ~~DistributedCache.Redis, Messaging.RabbitMQ~~ | ~~DONE~~ |
| ~~Microsoft.Extensions.Hosting.Abstractions~~ | ~~10.0.0~~ | ~~10.0.3~~ | ~~Geo.Client, Messaging.RabbitMQ~~ | ~~DONE~~ |
| ~~Microsoft.Extensions.Http.Resilience~~ | ~~10.0.0~~ | ~~10.3.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~Microsoft.Extensions.Logging.Abstractions~~ | ~~10.0.0~~ | ~~10.0.3~~ | ~~Handler, Messaging.RabbitMQ~~ | ~~DONE~~ |
| ~~Microsoft.Extensions.Options.ConfigurationExtensions~~ | ~~10.0.2~~ | ~~10.0.3~~ | ~~Geo.App~~ | ~~DONE~~ |
| ~~Microsoft.Extensions.ServiceDiscovery~~ | ~~10.0.0~~ | ~~10.3.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~Microsoft.NET.Test.Sdk~~ | ~~18.0.1~~ | ~~18.3.0~~ | ~~Geo.Tests, Tests~~ | ~~DONE~~ |
| Moq | 4.20.72 | 4.20.72 | Geo.Tests, Tests |
| ~~Npgsql~~ | ~~10.0.0~~ | ~~10.0.1~~ | ~~Errors.Pg~~ | ~~DONE~~ |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.0 | 10.0.0 | Geo.Infra, Transactions.Pg |
| ~~OpenTelemetry.Exporter.OpenTelemetryProtocol~~ | ~~1.14.0~~ | ~~1.15.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~OpenTelemetry.Exporter.Prometheus.AspNetCore~~ | ~~1.14.0-beta.1~~ | ~~1.15.0-beta.1~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~OpenTelemetry.Extensions.Hosting~~ | ~~1.14.0~~ | ~~1.15.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~OpenTelemetry.Instrumentation.AspNetCore~~ | ~~1.14.0~~ | ~~1.15.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~OpenTelemetry.Instrumentation.GrpcNetClient~~ | ~~1.14.0-beta.1~~ | ~~1.15.0-beta.1~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~OpenTelemetry.Instrumentation.Http~~ | ~~1.14.0~~ | ~~1.15.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~OpenTelemetry.Instrumentation.Process~~ | ~~1.14.0-beta.2~~ | ~~1.15.0-beta.1~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~OpenTelemetry.Instrumentation.Runtime~~ | ~~1.14.0~~ | ~~1.15.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~RabbitMQ.Client~~ | ~~7.1.2~~ | ~~7.2.1~~ | ~~Messaging.RabbitMQ~~ | ~~DONE~~ |
| ~~Serilog.AspNetCore~~ | ~~9.0.0~~ | ~~10.0.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~Serilog.Enrichers.ClientInfo~~ | ~~2.6.0~~ | ~~2.9.0~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| Serilog.Enrichers.Environment | 3.0.1 | 3.0.1 | ServiceDefaults |
| Serilog.Enrichers.Span | 3.1.0 | 3.1.0 | ServiceDefaults |
| ~~Serilog.Sinks.Grafana.Loki~~ | ~~8.3.1~~ | ~~8.3.2~~ | ~~ServiceDefaults~~ | ~~DONE~~ |
| ~~StackExchange.Redis~~ | ~~2.9.32~~ | ~~2.11.8~~ | ~~DistributedCache.Redis~~ | ~~DONE~~ |
| StyleCop.Analyzers | 1.2.0-beta.556 | 1.2.0-beta.556 | (Global) |
| ~~Testcontainers.PostgreSql~~ | ~~4.9.0~~ | ~~4.10.0~~ | ~~Geo.Tests, Tests~~ | ~~DONE~~ |
| ~~Testcontainers.RabbitMq~~ | ~~4.9.0~~ | ~~4.10.0~~ | ~~Geo.Tests~~ | ~~DONE~~ |
| ~~Testcontainers.Redis~~ | ~~4.9.0 / 4.8.1~~ | ~~4.10.0~~ | ~~Geo.Tests / Tests~~ | ~~DONE~~ |
| xunit.runner.visualstudio | 3.1.5 | 3.1.5 | Geo.Tests, Tests |
| ~~xunit.v3~~ | ~~3.2.0~~ | ~~3.2.2~~ | ~~Geo.Tests, Tests~~ | ~~DONE~~ |

</details>

## Appendix B: Full Node.js Package Inventory

<details>
<summary>Click to expand</summary>

### Production Dependencies

| Package | Version | Used By |
| ------- | ------- | ------- |
| @bufbuild/protobuf | 2.11.0 | @d2/protos |
| @grpc/grpc-js | 1.14.3 | @d2/protos, result-extensions, service-defaults, geo-client, auth-api, comms-api |
| @hono/node-server | 1.19.9 | @d2/auth-api |
| @opentelemetry/api | 1.9.0 | @d2/handler, service-defaults, web |
| @opentelemetry/api-logs | 0.206.0 | web |
| @opentelemetry/auto-instrumentations-node | 0.65.0 | service-defaults, web |
| @opentelemetry/exporter-logs-otlp-http | 0.206.0 | service-defaults, web |
| @opentelemetry/exporter-metrics-otlp-http | 0.206.0 | service-defaults, web |
| @opentelemetry/exporter-trace-otlp-http | 0.206.0 | service-defaults, web |
| @opentelemetry/exporter-trace-otlp-proto | 0.206.0 | web |
| @opentelemetry/instrumentation | 0.206.0 | web |
| @opentelemetry/instrumentation-document-load | 0.52.0 | web |
| @opentelemetry/instrumentation-fetch | 0.206.0 | web |
| @opentelemetry/resources | 2.1.0 | service-defaults, web |
| @opentelemetry/sdk-logs | 0.206.0 | service-defaults, web |
| @opentelemetry/sdk-metrics | 2.1.0 | service-defaults, web |
| @opentelemetry/sdk-node | 0.206.0 | service-defaults, web |
| @opentelemetry/sdk-trace-web | 2.1.0 | web |
| @opentelemetry/semantic-conventions | 1.37.0 | service-defaults, web |
| @stripe/stripe-js | 8.0.0 | web |
| better-auth | 1.4.18 | @d2/auth-infra |
| clsx | 2.1.1 | web |
| drizzle-orm | 0.45.1 | auth-infra, auth-api, comms-infra, comms-api |
| hono | 4.11.9 | @d2/auth-api |
| humanize-duration | 3.33.1 | web |
| import-in-the-middle | 1.14.4 | service-defaults, web |
| ioredis | 5.8.0 | cache-redis, auth-api, comms-api |
| isomorphic-dompurify | 2.36.0 | @d2/comms-app |
| libphonenumber-js | 1.12.23 | web |
| marked | 17.0.3 | @d2/comms-app |
| pg | 8.18.0 | auth-infra, auth-api, comms-infra, comms-api |
| pino | 9.6.0 | @d2/logging |
| postcode-validator | 3.10.5 | web |
| rabbitmq-client | 5.0.8 | @d2/messaging |
| resend | 4.5.1 | @d2/comms-infra |
| tailwind-merge | 3.3.1 | web |
| tailwind-variants | 3.1.1 | web |
| tailwindcss-motion | 1.1.1 | web |
| twilio | 5.12.2 | @d2/comms-infra |
| uuid | 13.0.0 | @d2/utilities |
| zod | 3.25.76 / 4.1.11 | handler, geo-client, comms-app/client, auth-app, ratelimit, idempotency / web |

### Dev Dependencies

| Package | Version | Used By |
| ------- | ------- | ------- |
| @better-auth/cli | 1.4.18 | auth-infra |
| @bufbuild/buf | 1.65.0 | @d2/protos |
| @eslint/js | 9.39.2 | root |
| @inlang/paraglide-js | 2.4.0 | web |
| @playwright/test | 1.55.1 | web |
| @sveltejs/adapter-node | 5.3.3 | web |
| @sveltejs/kit | 2.43.8 | web |
| @sveltejs/vite-plugin-svelte | 6.2.1 | web |
| @tailwindcss/vite | 4.1.14 | web |
| @testcontainers/postgresql | 10.18.0 | shared-tests, auth-tests, comms-tests, e2e-tests |
| @testcontainers/rabbitmq | 10.18.0 | shared-tests, auth-tests, comms-tests, e2e-tests |
| @testcontainers/redis | 10.18.0 | shared-tests, auth-tests, e2e-tests |
| @types/node | 22.18.8 | auth-domain, comms-domain, web |
| @types/pg | 8.16.0 | testing, auth-infra/api/tests, comms-infra/api/tests, e2e-tests |
| @vitest/browser | 3.2.4 | web |
| @vitest/coverage-v8 | 3.1.1 | root |
| drizzle-kit | 0.31.9 | auth-infra, comms-infra |
| eslint | 9.39.2 | root |
| eslint-config-prettier | 10.1.8 | root |
| eslint-plugin-svelte | 3.14.0 | root |
| globals | 16.4.0 | root |
| mdsvex | 0.12.6 | web |
| pino-pretty | 13.0.0 | @d2/logging |
| playwright | 1.55.1 | web |
| prettier | 3.8.1 | root |
| prettier-plugin-svelte | 3.4.1 | root |
| prettier-plugin-tailwindcss | 0.7.2 | root |
| svelte | 5.39.8 | web |
| svelte-check | 4.3.2 | web |
| tailwindcss | 4.1.14 | web |
| testcontainers | 10.18.0 | dkron-mgr-tests, e2e-tests |
| ts-proto | 2.11.2 | @d2/protos |
| tsx | 4.21.0 | auth-api, comms-api, dkron-mgr |
| typescript | 5.9.3 | root, web |
| typescript-eslint | 8.54.0 | root |
| vite | 7.1.9 | web |
| vitest | 3.1.1 / 3.2.4 | root, all test projects / web |
| vitest-browser-svelte | 1.1.0 | web |

</details>

## Appendix C: Container Image Inventory

<details>
<summary>Click to expand</summary>

### Infrastructure Containers (Aspire)

| Image | Current Tag | Latest | Volumes | Notes |
| ----- | ----------- | ------ | ------- | ----- |
| `postgres` | 18.0-trixie | 18.3-trixie | `d2-postgres-data` | Via `AddPostgres()` |
| `redis` | 8.2.1-bookworm | 8.2.4 / 8.6.1 | `d2-redis-data` | Via `AddRedis()` |
| `rabbitmq` | 4.1.4-management | 4.1.7 / 4.2.4 | `d2-rabbitmq-data` | Via `AddRabbitMQ()` |
| `dkron/dkron` | 4.0.9 | 4.0.9 | `d2-dkron-data` | Already latest |
| `minio/minio` | RELEASE.2025-09-07T16-13-09Z | **ARCHIVED** | `d2-minio-data` | Project archived Feb 2026 |
| `minio/mc` | RELEASE.2025-08-13T08-35-41Z | **ARCHIVED** | `d2-minio-tokens` | Init container |

### Observability Stack

| Image | Current Tag | Latest | Volumes | Notes |
| ----- | ----------- | ------ | ------- | ----- |
| `grafana/grafana` | 12.2.0 | 12.4.0 | `d2-grafana-data` | Auto-migrates |
| `grafana/loki` | 3.5.5 | 3.5.10 / 3.6.7 | `d2-loki-data` | |
| `grafana/tempo` | 2.8.2 | 2.10.1 | `d2-tempo-data` | Check vParquet |
| `grafana/mimir` | 2.17.1 | 2.17.7 | `d2-mimir-data` | CVE fix |
| `grafana/alloy` | v1.11.0 | v1.13.2 | `d2-alloy-data` | Collector agent |
| `gcr.io/cadvisor/cadvisor` | v0.50.0 | v0.56.2 | — | Stateless |

### Dev/Admin Tools

| Image | Current Tag | Latest | Volumes | Notes |
| ----- | ----------- | ------ | ------- | ----- |
| `dpage/pgadmin4` | 9.8.0 | 9.12 | — | |
| `redis/redisinsight` | 2.70.1 | 3.2.0 | `d2-redisinsight-data` | Major version |

### Exporters

| Image | Current Tag | Latest | Volumes | Notes |
| ----- | ----------- | ------ | ------- | ----- |
| `prometheuscommunity/postgres-exporter` | v0.18.1 | v0.19.1 | — | Stateless |
| `oliver006/redis_exporter` | v1.78.0 | v1.80.1 | — | Stateless |

### Testcontainers Images

| Image | Tag | Used In |
| ----- | --- | ------- |
| `postgres` | 18 | Node.js tests, .NET tests |
| `redis` | 8.2 | Node.js tests, .NET tests |
| `rabbitmq` | 4.1-management | Node.js tests, .NET tests |

</details>
