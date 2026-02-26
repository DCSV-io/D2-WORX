### Module 9: Middleware Stack

**Files reviewed**: 37 files, ~2,831 lines

Source files:

- `request-enrichment/default/src/enrich-request.ts` (94), `ip-resolver.ts` (62), `fingerprint-builder.ts` (35), `request-info.ts` (51), `request-enrichment-options.ts` (16), `index.ts` (13)
- `ratelimit/default/src/handlers/check.ts` (228), `rate-limit-options.ts` (31), `index.ts` (14)
- `idempotency/default/src/check-idempotency.ts` (71), `handlers/check.ts` (110), `idempotency-options.ts` (15), `index.ts` (3)
- Interface files from `@d2/interfaces` (reviewed cross-reference)
- Auth API middleware integration files (2)

Test files:

- `ip-resolver.test.ts` (150), `enrich-request.test.ts` (294), `fingerprint-builder.test.ts` (83)
- `ratelimit/check.test.ts` (604), `check.integration.test.ts` (153)
- `idempotency/check-idempotency.test.ts` (245), `idempotency-integration.test.ts` (284)

---

**Assumptions documented**:

1. **CloudFlare headers are trusted**: `CF-Connecting-IP` accepted without validation. Assumes application is behind CloudFlare.
2. **All proxy headers trusted in priority order**: No allowlist of trusted proxy IPs or header validation.
3. **WhoIs data from Geo service is trusted**: City/country/VPN flags used directly without sanitization.
4. **Rate limit dimensions are independent**: Blocking on one doesn't affect counters on others. All checked concurrently.
5. **Redis INCR is atomic**: Sliding window relies on this (correct).
6. **Idempotency keys are caller-controlled strings**: No format validation, length restriction, or user scoping.
7. **Fail-open is acceptable for all three packages**: When Redis or Geo unavailable, checks bypassed.
8. **Country whitelist (US, CA, GB)**: These countries exempt from country-level rate limiting.

---

**Findings**:

| #   | Severity | Category        | File:Line                                             | Description                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------- | --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **High** | Security        | `ratelimit/handlers/check.ts:55`                      | **Missing `isTrustedService` bypass on Node.js side.** .NET explicitly checks `requestInfo.IsTrustedService` and returns `isBlocked: false`. Node.js has no such check, and `IRequestInfo` lacks the field entirely. Service-to-service calls will be rate-limited like browser requests. Per architecture: "Trusted service bypasses: Rate limiting (all dimensions skipped)." |
| 2   | **High** | Security        | `idempotency/handlers/check.ts:42`                    | **No validation on idempotency key format or length.** Arbitrary string with no Zod validation, no max length. Attacker could send extremely long keys (MBs) to consume Redis memory or craft colliding keys. Key directly interpolated into Redis key: `` `${KEY_PREFIX}${input.idempotencyKey}` ``. Recommend: UUID format or max 256 chars.                                  |
| 3   | Medium   | Security        | `ip-resolver.ts:33-54`                                | **IP header spoofing when not behind trusted proxy.** All proxy headers trusted unconditionally. Without CloudFlare, attacker can set `CF-Connecting-IP: 127.0.0.1` to appear as localhost, skipping IP dimension. No configuration to restrict trusted headers.                                                                                                                |
| 4   | Medium   | Security        | `idempotency/check-idempotency.ts:38-40`              | **No scoping of idempotency keys to user/org.** Cache key is just `idempotency:{key}` with no user prefix. User A and User B sharing same key returns A's cached response to B.                                                                                                                                                                                                 |
| 5   | Medium   | Bug             | `ratelimit/handlers/check.ts:45-53`                   | **`zodIpAddress` rejects `"unknown"` and `"localhost"`.** `resolveIp()` returns `"unknown"` when no headers present. Rate limiter validates with `zodIpAddress` (uses `net.isIPv4`/`net.isIPv6`) BEFORE `isLocalhost` check. `"unknown"` fails validation → `VALIDATION_FAILED` → treated as fail-open. Generates noisy errors on every such request.                           |
| 6   | Medium   | Bug             | `idempotency/idempotency-options.ts:8,14`             | **`maxBodySizeBytes` defined but never enforced.** Option exists (default 1 MB) but neither `check-idempotency.ts` nor `handlers/check.ts` checks response body size before storing. Large responses stored in Redis regardless.                                                                                                                                                |
| 7   | Medium   | Performance     | `ratelimit/handlers/check.ts:162-166`                 | **Unnecessary increment of current window when already blocked.** All three Redis ops fire concurrently. If blocked key exists, current-window increment wasted. Code acknowledges: "extra increment is harmless (counter auto-expires)." Counters slightly over-count during blocks.                                                                                           |
| 8   | Medium   | Consistency     | `request-info.ts:19-20`                               | **`userId` and `isAuthenticated` are mutable while other fields readonly.** Intentional (set by auth middleware later), but worth documenting as deliberate design.                                                                                                                                                                                                             |
| 9   | Low      | Security        | `fingerprint-builder.ts:24-35`                        | **Server fingerprint uses only 4 headers.** SHA-256 of `UA                                                                                                                                                                                                                                                                                                                      | accept-language | accept-encoding | accept` — trivially reproducible. Documented as non-security-boundary, but operators might assume it identifies unique clients. |
| 10  | Low      | Security        | `distributed-rate-limit.ts:13-18`                     | **Rate limiting skipped entirely when `requestInfo` missing from context.** If enrichment middleware fails, rate limiter silently skips all checks. Fail-open by design.                                                                                                                                                                                                        |
| 11  | Low      | Bug             | `ratelimit/handlers/check.ts:194-196`                 | **Sliding window weight uses `getUTCSeconds()` (position in clock minute, not window).** Correct ONLY for 60s windows. If `windowMs` changed to 30s or 120s, weight calculation would be wrong.                                                                                                                                                                                 |
| 12  | Low      | Consistency     | `check-idempotency.ts:5-6` and `handlers/check.ts:10` | **Duplicate `KEY_PREFIX` constant.** Both files define `const KEY_PREFIX = "idempotency:"` independently. Divergence risk if only one changes.                                                                                                                                                                                                                                  |
| 13  | Low      | Consistency     | All three packages                                    | **Inconsistent handler pattern.** Request enrichment uses plain async function, rate limiting uses BaseHandler, idempotency uses both. Pragmatic but consumers wire them differently.                                                                                                                                                                                           |
| 14  | Low      | Maintainability | `ratelimit/handlers/check.ts:127-134`                 | **Window ID manually constructed.** `getWindowId` formats `YYYY-MM-DDTHH:MM` from UTC components. `toISOString().slice(0, 16)` would be shorter.                                                                                                                                                                                                                                |
| 15  | Low      | Elegance        | `enrich-request.ts:47-79`                             | **RequestInfo constructed twice when WhoIs succeeds.** Entire object rebuilt rather than updated (readonly fields require this).                                                                                                                                                                                                                                                |
| 16  | Low      | Consistency     | `ratelimit/default/package.json`                      | **Direct `zod` dep in ratelimit but not idempotency.** If idempotency adds validation, would need zod too.                                                                                                                                                                                                                                                                      |
| 17  | Low      | Maintainability | `idempotency/handlers/check.ts:86`                    | **Unsafe `JSON.parse` with `as` cast for cached response.** No validation of `body`/`contentType` types. Corrupted cache entry produces wrong data.                                                                                                                                                                                                                             |
| 18  | Low      | Test Gap        | `idempotency/handlers/check.ts:41`                    | **Idempotency Check handler has no Zod validation.** Unlike rate limiter, no input validation. Overlaps with Finding #2.                                                                                                                                                                                                                                                        |
| 19  | Low      | Elegance        | `ratelimit/default/src/index.ts:6-12`                 | **Deprecated re-exports add noise.** Could be removed since consumers should import from `@d2/interfaces`.                                                                                                                                                                                                                                                                      |

---

**Security model analysis**:

1. **Rate limiting bypassable**: Forging `CF-Connecting-IP: 127.0.0.1` skips IP dimension. No `X-Client-Fingerprint` skips fingerprint. WhoIs unavailable skips city/country. US/CA/GB exempt from country. Missing `isTrustedService` bypass is a .NET parity gap.
2. **IP resolution trusts proxy headers unconditionally**: Standard for behind-reverse-proxy but not configurable.
3. **Idempotency key validation insufficient**: No validation at all. Needs length limits, format validation (UUID), and user-scoping.
4. **Fail-open is deliberate**: Redis outage removes all enforcement. Acceptable for pre-alpha SMB target.

---

**Tests to add**:

- [ ] Rate limiter: `"unknown"` IP handling — confirm fail-open behavior
- [ ] Rate limiter: `"localhost"` IP handling — fails `zodIpAddress`
- [ ] Rate limiter: `isTrustedService` bypass (once field added)
- [ ] Idempotency: key length/format attack (1MB string, empty, special chars)
- [ ] Idempotency: `maxBodySizeBytes` enforcement (once implemented)
- [ ] Idempotency: cross-user key collision
- [ ] Rate limiter: non-60s window correctness (exposes Finding #11)
- [ ] Request enrichment: IPv4-mapped IPv6 localhost (`::ffff:127.0.0.1`)
- [ ] Request enrichment: partial WhoIs data (city but no country)
- [ ] Rate limiter: concurrent dimension block race

**Tests to remove**:

- (None — all existing tests are valid)
