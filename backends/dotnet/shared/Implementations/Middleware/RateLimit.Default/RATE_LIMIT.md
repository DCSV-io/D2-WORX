# RateLimit.Default

HTTP middleware implementing multi-dimensional sliding-window rate limiting using distributed cache abstractions.

## Files

| File Name                                               | Description                                                   |
|---------------------------------------------------------|---------------------------------------------------------------|
| [Interfaces/IRateLimit.cs](Interfaces/IRateLimit.cs)    | Base partial interface for rate limit handlers.               |
| [Interfaces/IRateLimit.Check.cs](Interfaces/IRateLimit.Check.cs) | Handler interface for rate limit checking.             |
| [Handlers/Check.cs](Handlers/Check.cs)                  | Handler implementing sliding window rate limit algorithm.     |
| [RateLimitDimension.cs](RateLimitDimension.cs)          | Enum defining rate limit dimensions.                          |
| [RateLimitOptions.cs](RateLimitOptions.cs)              | Configuration options with thresholds per dimension.          |
| [RateLimitMiddleware.cs](RateLimitMiddleware.cs)        | HTTP middleware that invokes the Check handler.               |
| [Extensions.cs](Extensions.cs)                          | DI registration and app builder extension methods.            |

## Overview

Rate limiting operates on four dimensions in hierarchy order:

| Dimension            | Default Threshold | Skip Condition                    | Rationale                     |
|----------------------|-------------------|-----------------------------------|-------------------------------|
| Client Fingerprint   | 100/min           | Header not present                | Single device — strictest     |
| IP                   | 5,000/min         | Localhost/loopback                | ~50 devices × 100             |
| City                 | 25,000/min        | WhoIs data unavailable            | ~250 devices × 100            |
| Country              | 100,000/min       | Whitelisted or WhoIs unavailable  | ~1000 devices × 100           |

**Hierarchy evaluation**: Checks proceed in order from strictest (fingerprint) to most lenient (country). If any dimension is blocked, remaining dimensions are skipped.

## Sliding Window Approximation Algorithm

Uses two fixed-window counters per dimension with weighted average — no Lua scripts required.

**Redis key format:**
- Counter: `ratelimit:{dimension}:{value}:{window_id}`
- Block: `blocked:{dimension}:{value}`

Where `{window_id}` = `yyyy-MM-ddTHH:mm` (minute-granularity UTC timestamp).

**Algorithm per dimension:**

1. Check `blocked:{dim}:{val}` — if exists, return blocked + TTL as RetryAfter
2. Get `ratelimit:{dim}:{val}:{prev_window}` count (INCR by 0)
3. Get `ratelimit:{dim}:{val}:{curr_window}` count (INCR by 1)
4. Calculate weight: `1 - (seconds_into_current_window / 60)`
5. Calculate estimate: `(prev_count × weight) + curr_count`
6. If `estimate > threshold`:
   - Set `blocked:{dim}:{val}` with BlockDuration TTL
   - Return blocked
7. Return allowed

## Configuration

```csharp
public class RateLimitOptions
{
    public TimeSpan Window { get; set; } = TimeSpan.FromMinutes(1);
    public TimeSpan BlockDuration { get; set; } = TimeSpan.FromMinutes(5);

    public int ClientFingerprintThreshold { get; set; } = 100;
    public int IpThreshold { get; set; } = 5_000;
    public int CityThreshold { get; set; } = 25_000;
    public int CountryThreshold { get; set; } = 100_000;

    public List<string> WhitelistedCountryCodes { get; set; } = ["US", "CA", "GB"];
}
```

## Usage

```csharp
// In Program.cs or Startup.cs

// Register services (requires Redis connection string).
builder.Services.AddRateLimiting(redisConnectionString, builder.Configuration);

// Add middleware (after request enrichment).
app.UseRateLimiting();
```

## 429 Response

When rate limited, the middleware returns:
- Status code: `429 Too Many Requests`
- Error code: `RATE_LIMITED`
- `Retry-After` header with remaining block duration in seconds

## Fail-Open Behavior

- **Redis down**: Log warning, allow request through.
- **WhoIs unavailable**: City + Country dimensions skipped.
- **No client fingerprint header**: Fingerprint dimension skipped.
- **Localhost**: IP dimension skipped.

## Dependencies

Uses project-defined distributed cache abstractions (no direct Redis dependency):

- `IRead.IGetTtlHandler` — Check if blocked key exists and get TTL.
- `IUpdate.IIncrementHandler` — Atomic counter increment with TTL.
- `IUpdate.ISetHandler<string>` — Set block key with TTL.

Requires `RequestEnrichment.Default` for `IRequestInfo` on `HttpContext.Features`.
