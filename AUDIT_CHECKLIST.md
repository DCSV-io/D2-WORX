# Audit Checklist — D2-WORX Quality Sweep

> **Purpose**: Reusable checklist for quality audits. The user will specify the scope:
>
> - **Solution-wide sweep**: Audit ALL files in the ENTIRE solution, regardless of change history
> - **Main diff sweep**: Audit only files in `git diff main` (modified + added on the current branch)
>
> **Usage**: Copy this checklist into a new .md file at project root for tracking sweep progress. Check off each item as they are verified. All items must pass before the audit is complete.

---

## Security

- [ ] IDOR checks on every endpoint/handler that accesses resources by ID
- [ ] **Session-derived identifiers** — endpoints must NEVER accept user-provided userId, orgId, or role when those values can be resolved from the session/JWT. Derive scope from claims, not from request body/params. User-supplied identifiers for these fields = IDOR vulnerability
- [ ] Auth bypass paths — can unauthenticated requests reach protected handlers?
- [ ] Input validation completeness — every handler has Zod schema at top of `executeAsync`
- [ ] String max lengths on all Zod string fields
- [ ] Constant-time comparisons on all secret/key comparisons (`timingSafeEqual` / `CryptographicOperations.FixedTimeEquals`)
- [ ] Header injection / XSS via user-controlled response data (Content-Disposition, error messages)
- [ ] gRPC service-key auth on all non-health RPCs (fail-closed when no keys configured)
- [ ] JWT claim validation — null checks before trusting claims
- [ ] CORS configuration — allowed origins, headers (incl. `X-Client-Fingerprint`), methods
- [ ] No sensitive data in error responses (no stack traces, no internal paths)
- [ ] API key configuration — inter-service keys exist in both caller and callee config
- [ ] No empty strings as data — `""` must NEVER represent absent/missing data. Use `null` (C#) or `undefined` (TS). Convert at boundaries: TS `truthyOrUndefined()`, C# `.ToNullIfEmpty()`
- [ ] Proto `optional` keyword on all nullable domain fields — proto3 defaults (`""`, `0`, `false`) are indistinguishable from "not set" without `optional`. Required fields (IDs, keys, status) stay non-optional
- [ ] Auth middleware must fail-closed on missing config — empty API key mappings or missing secrets = 401 immediately
- [ ] Infrastructure paths exempt from ALL business middleware (not just some)
- [ ] Multi-column key lookups use paired predicates — `(col1=A AND col2=1) OR (col1=B AND col2=2)`, not independent `OR`s

## Logic / Data Integrity

- [ ] Pipeline completeness — no gaps in multi-step flows (e.g., upload -> intake -> publish -> process -> callback -> push)
- [ ] Error propagation — no swallowed failures, no `ok()` after unchecked downstream operations
- [ ] Never return `ok()` after a branching operation unconditionally — if a nested handler or provider can fail, check its result. Either `bubbleFail` or explicitly handle the error
- [ ] Status state machine adherence — can entities get stuck in invalid states?
- [ ] Fire-and-forget operations properly caught (`.catch()` with logging)
- [ ] Drizzle UPDATE/DELETE chains `.returning()` and checks for empty results -> `notFound()`
- [ ] DI registration completeness — every handler registered, no missing keys, no stale registrations
- [ ] Race conditions — concurrent operations, duplicate messages, double-processing
- [ ] Resource leaks — DI scopes disposed, gRPC clients cleaned up, connections closed
- [ ] Drizzle `null` -> `undefined` at mapper boundary — Drizzle returns `null` for nullable columns; domain types use `undefined`. Map with `truthyOrUndefined()` or `?? undefined` in repo handler mappers
- [ ] Auth flags initialize to `null`, not `false` — `isAuthenticated`, `isTrustedService`, `isOrgEmulating`, `isUserImpersonating` use `boolean | null` (C#: `bool?`). `null` = "not yet determined" (pre-auth). `false` = "confirmed not"

## Code Quality (CLAUDE.md S5)

- [ ] RedactionSpec on ALL handlers touching PII (displayName, presignedUrl, email, IP — NOT UUIDs). Applies to BOTH app AND repo handlers. Use `suppressOutput: true` when output contains nested PII
- [ ] RedactionSpec covers auto I/O logging only — manual `logger.*` calls reviewed for PII leaks. Never log fields that appear in `inputFields`/`outputFields` redaction list via manual log calls
- [ ] Semantic D2Result factories — no raw `fail()` when a factory exists (Ok, Created, NotFound, Unauthorized, Forbidden, ValidationFailed, Conflict, ServiceUnavailable, UnhandledException, PayloadTooLarge, Cancelled, SomeFound)
- [ ] Validate inputs BEFORE infrastructure calls — Zod `validateInput()` (Node.js) or FluentValidation (.NET) at TOP of `executeAsync`, before any downstream calls
- [ ] No `!` for silencing warnings (only after Falsey/Truthy early return guard where value is guaranteed non-null)
- [ ] Build warnings = bugs — zero warnings on `tsc`, `eslint`, `prettier`, `dotnet build`, `jb inspectcode`
- [ ] Prefer `undefined` over `null` in TypeScript — use optional syntax (`field?: string`) instead of `field: string | null`. Exception: `IRequestContext` auth flags use `boolean | null` for three-state pre-auth semantics
- [ ] Use `?: T` syntax for optional domain fields in TS interfaces/types, not `field: T | undefined`
- [ ] Zod schemas use `.optional()` not `.nullable()` — domain types use `?: T` (undefined), so Zod must match. Never `.nullable()` or `.nullish()` for domain-aligned validation
- [ ] `truthyOrUndefined()` (TS) / `ToNullIfEmpty()` (C#) at all boundaries — user input, DB rows, proto values -> domain types. Prevents empty strings from polluting domain models
- [ ] Structured logger (`this.context.logger.*`) not `console.*` — all logging through the structured logger for OTel correlation
- [ ] Domain model is source of truth for nullability — if domain field is optional, proto field MUST use `optional` keyword
- [ ] C# `string.Empty` always — never `""` (StyleCop SA1122)
- [ ] C# `Falsey()`/`Truthy()` handle null — never `if (value is null || value.Falsey())`, just `if (value.Falsey())`
- [ ] C# nullable types (`string?`, `bool?`, `int?`, `DateTime?`) for optional domain fields — never `= string.Empty` on optional record properties
- [ ] C# `ToNullIfEmpty()` at boundaries — proto/DB/external strings to domain types. Returns `null` if null, empty, or whitespace-only

## Conventions (CLAUDE.md S6)

- [ ] C# file headers on all `.cs` files (copyright block)
- [ ] C# naming conventions: `r_camelCase` (readonly), `_camelCase` (mutable), `sr_camelCase` (static readonly), `_UPPER_CASE` (private constants), `UPPER_CASE` (public constants)
- [ ] TS naming: `camelCase` functions/variables, `PascalCase` types/classes/interfaces, `kebab-case` files/modules
- [ ] Observability fields (traceId, correlationId, userId, orgId, service) on logs/spans
- [ ] i18n — no hardcoded user-visible strings (UI, handler messages, input errors, notifications). TK constants from `@d2/i18n` / `D2.Shared.I18n`, not bare string literals outside D2Result factories
- [ ] Git: conventional commits with scope, no `Co-Authored-By` lines

## Cross-Service

- [ ] Proto contracts match both caller and implementor — field names, types, optional keywords
- [ ] Proto `optional` keyword for all nullable domain fields — both `.proto` definition AND generated code consumers. `useOptionals=all` in ts-proto config. C# uses `HasField` pattern for proto3 optional
- [ ] Docker dependency chain — startup order, health checks, port conflicts
- [ ] Env var completeness — every var read in code exists in `.env.local` + `.env.local.example`
- [ ] `.env.local.example` placeholder values are realistic (correct ports, hostnames, patterns)
- [ ] Cross-platform enum/constant changes in one commit — `.NET` and `Node.js` must match for shared enums stored as text in DB

## Test Coverage

- [ ] Every new handler has unit tests
- [ ] Adversarial cases covered (invalid input, missing fields, boundary values, garbage data)
- [ ] Access control tested (forbidden/unauthorized paths)
- [ ] Error propagation tested (downstream failures bubble correctly)
- [ ] Integration tests for repo handlers (Testcontainers)
- [ ] All existing tests still pass (zero regressions)
- [ ] Idempotency tested where applicable (duplicate submissions)
- [ ] Concurrency tested where applicable (race conditions)

## Documentation

- [ ] Every new handler/service/endpoint reflected in `.md` files
- [ ] PLANNING.md phasing table accurate
- [ ] CLAUDE.md reference table includes all new docs
- [ ] No stale "Pending" or "not yet implemented" references for completed work
- [ ] Test counts updated in PLANNING.md Services table
