# Utilities

Shared utility extensions and helpers used across all contracts and services. Provides environment variable loading, string cleaning, collection operations, GUID validation, and content-addressable hashing.

## Files

| File Name                                                     | Description                                                                                                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [D2Env.cs](D2Env.cs)                                          | Convention-based `.env` file loader. Reads `.env.local` / `.env`, sets original + infrastructure transform (`Parameters__kebab-case`) + options transform (`Section__Property`) per entry. |
| [RedactDataAttribute.cs](Attributes/RedactDataAttribute.cs)   | Attribute marking properties/fields for redaction in logs and telemetry, specifies RedactReason enum and optional custom reason for privacy/security compliance.                           |
| [RedactReason.cs](Enums/RedactReason.cs)                      | Enum defining redaction categories: Unspecified, PersonalInformation, FinancialInformation, SecretInformation, VerboseContent, Other.                                                      |
| [StringExtensions.cs](Extensions/StringExtensions.cs)         | String utilities with Truthy/Falsey checks, CleanStr whitespace normalization, email/phone validation, and normalized string generation for content-addressable hashing.                   |
| [EnumerableExtensions.cs](Extensions/EnumerableExtensions.cs) | Collection extensions with Truthy/Falsey checks, Clean operation applying transformation functions with configurable null handling and empty enumerable behavior.                          |
| [GuidExtensions.cs](Extensions/GuidExtensions.cs)             | GUID validation extensions checking for null and Guid.Empty states with Truthy/Falsey semantic helpers.                                                                                    |
| [SerializerOptions.cs](Serialization/SerializerOptions.cs)    | Reusable System.Text.Json serialization configurations with reference cycle handling for Redis caching.                                                                                    |

## Circuit Breaker

Lightweight circuit breaker (`CircuitBreaker<T>`) for protecting async operations against sustained downstream failures. Three states: **Closed** (normal) → **Open** (fast-fail) → **HalfOpen** (one probe allowed).

| File                                                                | Description                                                                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [CircuitBreaker.cs](CircuitBreaker/CircuitBreaker.cs)               | Generic circuit breaker with thread-safe state via `Interlocked`. Tracks consecutive failures, opens at threshold, probes after cooldown. |
| [CircuitState.cs](CircuitBreaker/CircuitState.cs)                   | Enum: Closed (0), Open (1), HalfOpen (2).                                                                                                 |
| [CircuitBreakerOptions.cs](CircuitBreaker/CircuitBreakerOptions.cs) | Configuration record: FailureThreshold (default 5), CooldownDuration (default 30s), NowFunc (test seam).                                  |
| [CircuitOpenException.cs](CircuitBreaker/CircuitOpenException.cs)   | Exception thrown when the circuit is open and no fallback is provided.                                                                    |

### Usage

```csharp
var cb = new CircuitBreaker<MyResponse>(
    isFailure: r => !r.Success,  // optional result-based failure detection
    options: new CircuitBreakerOptions
    {
        FailureThreshold = 5,
        CooldownDuration = TimeSpan.FromSeconds(30),
    },
    onStateChange: (from, to) => logger.LogWarning("Circuit: {From} → {To}", from, to));

var result = await cb.ExecuteAsync(
    ct => myClient.CallAsync(request, ct),
    ct: cancellationToken);
```

**Fail-open pattern** (used by Geo.Client `FindWhoIs`): Catch both `RpcException` and `CircuitOpenException` — when the circuit is open, `ExecuteAsync` throws `CircuitOpenException` instantly (no timeout wait). Node.js equivalent: `@d2/utilities` `CircuitBreaker` class.

## `ToNullIfEmpty`

```csharp
extension(string? s)
{
    public string? ToNullIfEmpty()
}
```

Returns `null` if the string is null, empty, or whitespace-only; otherwise returns the trimmed string. Uses `Falsey()` internally. Use at data boundaries (DB rows, proto mapping, user input) to convert empty strings to `null` before they propagate as "valid" data.

```csharp
"  hello  ".ToNullIfEmpty()      // "hello"
"  hello world ".ToNullIfEmpty() // "hello world" (internal space preserved)
"   ".ToNullIfEmpty()            // null
"".ToNullIfEmpty()               // null
((string?)null).ToNullIfEmpty()  // null
```

**Node.js counterpart:** `truthyOrUndefined()` in `@d2/utilities` (returns `undefined` instead of `null`).
