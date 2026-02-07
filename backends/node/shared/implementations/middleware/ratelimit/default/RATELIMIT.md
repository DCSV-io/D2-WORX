# @d2/ratelimit

Multi-dimensional sliding-window rate limiting. Mirrors `RateLimit.Default` in .NET. Layer 5.

## Files

| File Name                                            | Description                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| [handlers/check.ts](src/handlers/check.ts)           | `Check` handler — sliding window approximation across 4 dimensions.            |
| [rate-limit-options.ts](src/rate-limit-options.ts)   | `RateLimitOptions` + `DEFAULT_RATE_LIMIT_OPTIONS`.                             |
| [index.ts](src/index.ts)                             | Barrel re-export of `Check` handler + options (with deprecation notices).      |

## Dimensions

Rate limiting operates on four dimensions in hierarchy order:

| Dimension          | Default Threshold | Skip Condition                   | Rationale                 |
| ------------------ | ----------------- | -------------------------------- | ------------------------- |
| Client Fingerprint | 100/min           | Header not present               | Single device — strictest |
| IP                 | 5,000/min         | Localhost/loopback               | ~50 devices x 100         |
| City               | 25,000/min        | WhoIs data unavailable           | ~250 devices x 100        |
| Country            | 100,000/min       | Whitelisted or WhoIs unavailable | ~1000 devices x 100       |

## Sliding Window Algorithm

Uses two fixed-window counters per dimension with weighted average — no Lua scripts required.

1. Check `blocked:{dim}:{val}` — if exists, return blocked + TTL as RetryAfter
2. Get previous window count (INCR by 0)
3. Get current window count (INCR by 1)
4. Calculate weight: `1 - (seconds_into_current_window / 60)`
5. Calculate estimate: `(prev_count x weight) + curr_count`
6. If estimate > threshold → set block key with `BlockDuration` TTL → return blocked

## Dependencies

Uses distributed cache abstractions from `@d2/interfaces` (no direct Redis dependency):

- `DistributedCache.IGetTtlHandler` — check if blocked key exists and get TTL
- `DistributedCache.IIncrementHandler` — atomic counter increment with TTL
- `DistributedCache.ISetHandler` — set block key with TTL

Contract types (`ICheckHandler`, `CheckInput/Output`, `RateLimitDimension`) are defined in `@d2/interfaces` — the `index.ts` re-exports are marked `@deprecated` to guide consumers to the contract package.

## Data Redaction

The `Check` handler declares `CHECK_REDACTION` (from `@d2/interfaces`) which suppresses input logging because `IRequestInfo` contains PII (client IP, fingerprint, user ID, city).

## Fail-Open Behavior

- **Redis down**: Log warning, allow request through
- **WhoIs unavailable**: City + Country dimensions skipped
- **No client fingerprint**: Fingerprint dimension skipped
- **Localhost**: IP dimension skipped

## .NET Equivalent

`RateLimit.Default` — same sliding window algorithm, same 4 dimensions, same fail-open behavior. Uses `DefaultOptions` for input logging suppression instead of `RedactionSpec`.
