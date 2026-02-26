# Secondary Codebase Sweep Plan (Pre-PR)

**Date:** 2026-02-26
**Branch:** `feat/comms`
**Target:** Merge to `main`

---

## 1. Build + Test Verification

Full rebuild and test suite pass required before PR.

| Step | Command                                                               | Expected             |
| ---- | --------------------------------------------------------------------- | -------------------- |
| 1a   | `pnpm build` (all Node.js packages)                                   | 0 errors             |
| 1b   | `dotnet build D2.sln`                                                 | 0 errors, 0 warnings |
| 1c   | `pnpm vitest run --project shared-tests`                              | 844 passed           |
| 1d   | `pnpm vitest run --project auth-tests`                                | 853 passed           |
| 1e   | `pnpm vitest run --project comms-tests`                               | 552 passed           |
| 1f   | `dotnet test backends/dotnet/shared/Tests/Tests.csproj`               | 677 passed           |
| 1g   | `dotnet test backends/dotnet/services/Geo/Geo.Tests/Geo.Tests.csproj` | 759 passed           |

## 2. Lint + Format Check

| Step | Command                          | Expected             |
| ---- | -------------------------------- | -------------------- |
| 2a   | `pnpm eslint . --max-warnings 0` | 0 warnings, 0 errors |
| 2b   | `pnpm prettier --check .`        | All files formatted  |

## 3. Remaining Documentation Gaps (Low Priority)

Items found during the full doc sweep that are minor and won't block the PR. Can be addressed post-merge or in a follow-up.

### Missing `service-keys.ts` from File Tables

Several package docs don't list their `service-keys.ts` DI convenience files. These are consistent omissions (every package that has DI keys has this file, but none document it). Consider adding as a batch:

| Package            | File                  | Exports                                                  |
| ------------------ | --------------------- | -------------------------------------------------------- |
| `@d2/logging`      | `src/service-keys.ts` | `ILoggerKey`                                             |
| `@d2/messaging`    | `src/service-keys.ts` | `IMessageBusKey`, `IMessageBusPingKey`                   |
| `@d2/cache-memory` | `src/service-keys.ts` | `createMemoryCacheStoreKey`, cache handler key factories |
| `@d2/cache-redis`  | `src/service-keys.ts` | `IRedisKey`, `ICachePingKey`, factory functions          |

### Missing Internal Utility Files from Docs

| Package           | File                    | Purpose                             |
| ----------------- | ----------------------- | ----------------------------------- |
| `@d2/cache-redis` | `redis-error-result.ts` | Shared Redis error handling utility |
| `@d2/ratelimit`   | `cache-keys.ts`         | Rate limit cache key generation     |
| `@d2/idempotency` | `cache-keys.ts`         | Idempotency cache key generation    |

### HANDLER.md Missing File

| Package       | File                      | Purpose                                                        |
| ------------- | ------------------------- | -------------------------------------------------------------- |
| `@d2/handler` | `create-service-scope.ts` | Shared per-request DI scope factory (used by Auth, Comms, E2E) |

### MESSAGING.md Missing Handler

The `PingMessageBus` handler (`handlers/q/ping.ts`) exists in `@d2/messaging` but is not listed in MESSAGING.md's Files table.

## 4. Code Quality Checks

### 4a. Unused Exports Scan

Search for exports that are no longer imported anywhere:

```bash
# Find all exported symbols in shared packages
# Cross-reference with imports across the codebase
# Flag any orphaned exports
```

Focus areas:

- `@d2/comms-domain` — Phase 2/3 entities exported but unused until those phases
- `@d2/comms-app` — Repository handler interface types (should be used by infra)
- `@d2/interfaces` — Middleware contracts (all should have at least one consumer)

### 4b. Circular Dependency Check

```bash
# Use madge or manual inspection
# Check for: app → infra, infra → api, domain → app cycles
```

Known clean: Auth and Comms both follow strict app→infra→api layering.

### 4c. TypeScript Strict Compliance

```bash
pnpm tsc --noEmit --project backends/node/tsconfig.base.json
```

Verify all packages compile clean under strict mode.

### 4d. Dependency Version Audit

Confirm all `package.json` files use exact versions (no `^` or `~`):

```bash
grep -r '"[\^~]' backends/node/*/package.json backends/node/services/*/package.json
```

Should return 0 results.

## 5. Security Checks

### 5a. No Secrets in Committed Files

```bash
# Check for hardcoded keys, tokens, passwords
grep -rn "password\|secret\|apikey\|api_key" --include="*.ts" --include="*.cs" | grep -v "test\|mock\|stub\|example\|\.md"
```

### 5b. .env Files Not Committed

```bash
git ls-files | grep "\.env"
```

Only `.env.example` files should be tracked.

### 5c. Input Validation Coverage

Verify all CQRS handlers call `this.validateInput()`:

- Auth: 8 command + 5 query handlers
- Comms: 5 handlers (Deliver, RecipientResolver, SetChannelPreference, GetChannelPreference, CheckHealth)

## 6. Git Hygiene

### 6a. Commit History Review

```bash
git log --oneline main..HEAD
```

- All commits follow Conventional Commits format
- No accidental merge commits
- No WIP or fixup commits that should be squashed

### 6b. Diff Review

```bash
git diff main...HEAD --stat
```

Review the full change set for:

- Unintended file changes
- Large binary files
- Generated code that shouldn't be committed
- Any changes outside the expected scope

### 6c. No Stale dist/ Artifacts

```bash
# Verify no stale compiled output
find backends/node -name "dist" -type d | while read d; do
  # Check each dist/ is clean (matches source)
done
```

## 7. PR Description Checklist

When creating the PR, ensure the description covers:

- [ ] Summary of all changes (test gaps, stale artifacts, doc fixes)
- [ ] Test results (all 5 suites passing)
- [ ] Breaking changes: none
- [ ] New dependencies: none (we removed one)
- [ ] Documentation: 22 Section 6 issues fixed + full doc sweep
- [ ] Sections 5 + 7 of CONSOLIDATED-FINDINGS.md fully resolved
