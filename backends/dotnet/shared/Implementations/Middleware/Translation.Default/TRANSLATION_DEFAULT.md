# Translation.Default — Response Translation Middleware

HTTP middleware that intercepts D2Result JSON responses and translates message keys and input error keys to localized text based on the request's locale.

## Files

| File Name                                            | Description                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| [TranslationMiddleware.cs](TranslationMiddleware.cs) | Middleware that buffers responses, detects D2Result JSON, and translates keys.    |
| [LocaleResolver.cs](LocaleResolver.cs)               | Resolves the request locale from headers with priority order and quality weights. |
| [Extensions.cs](Extensions.cs)                       | DI registration (`AddTranslation`) and middleware (`UseTranslation`) extensions.  |

## Overview

The middleware intercepts all JSON responses, detects D2Result objects (by the presence of a top-level `statusCode` property), and translates translation keys in two target arrays:

- **`messages[]`** — each string entry is translated if it matches a known key.
- **`inputErrors[]`** — each sub-array has the shape `[fieldName, error1, error2, ...]`. Index 0 (field name) is preserved unchanged; index 1+ entries are translated if they match known keys.

Non-matching strings pass through unchanged — literal messages (not translation keys) are unaffected.

## TranslationMiddleware

### Behavior

1. **Buffer** — replaces `Response.Body` with a `MemoryStream` to capture the downstream response.
2. **Delegate** — calls `next(context)` to execute the rest of the pipeline.
3. **Detect** — checks if the response is JSON (`application/json` content type) and non-empty.
4. **Parse** — attempts to parse the buffered JSON. If parsing fails, passes through as-is.
5. **D2Result check** — looks for a top-level `statusCode` property. If absent, passes through as-is.
6. **Translate** — resolves the locale from the request, translates `messages[]` and `inputErrors[]` entries via `ITranslator.HasKey()` + `ITranslator.T()`.
7. **Write** — serializes the translated result back to the original response stream.

### Non-D2Result Responses

Any response that is not JSON, not parseable, or lacks a `statusCode` property is written to the response stream unchanged. The middleware is a no-op for static files, HTML, binary responses, etc.

## LocaleResolver

Resolves the request locale by examining headers in priority order:

| Priority | Source             | Description                                                                                                                   |
| -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1        | `D2-Locale` header | Explicit locale preference set by SvelteKit. Delegates to `SupportedLocales.Resolve()` (handles bare language codes, casing). |
| 2        | `Accept-Language`  | Browser default. Parsed with quality weights, sorted descending. Exact match first, then language-family fallback.            |
| 3        | Fallback           | `SupportedLocales.BASE` (configurable via `PUBLIC_DEFAULT_LOCALE` env var, defaults to `"en-US"`).                            |

### Accept-Language Parsing

The resolver parses RFC 7231 quality-weighted tags. For example, `fr-CA,fr;q=0.9,en;q=0.8` yields candidates `["fr-ca", "fr", "en"]` in descending quality order.

- Exact match via `SupportedLocales.IsValid()` (normalized to BCP 47 casing via `SupportedLocales.ToBcp47()`).
- Language-family fallback: if `fr-ch` is not supported, try the language prefix `fr` via `SupportedLocales.LanguageDefaults` → first matching locale (`fr-FR`).
- Supported locales: `en-US`, `en-CA`, `en-GB`, `fr-FR`, `fr-CA`, `es-ES`, `es-MX`, `de-DE`, `it-IT`, `ja-JP` (BCP 47 tags from `PUBLIC_ENABLED_LOCALES` env var).

## Configuration

Config section: `GATEWAY_TRANSLATION` (reserved for future options — currently unused beyond section binding).

## Pipeline Placement

```
Request
  │
  ├─ UseRequestEnrichment()
  ├─ UseServiceKeyDetection()
  ├─ UseRateLimiting()
  ├─ UseJwtAuth()
  ├─ UseIdempotency()
  ├─ UseTranslation()        ← must be AFTER idempotency (wraps all responses)
  └─ Endpoint
```

The middleware must run after idempotency so that cached idempotent responses also get translated for the current request's locale.

## Usage

```csharp
// Register services — loads message catalogs from messages/ directory.
builder.Services.AddTranslation(builder.Configuration);

// Add middleware (after idempotency, wraps all endpoint responses).
app.UseTranslation();
```

## Messages Directory

Translation catalogs are loaded from `AppContext.BaseDirectory/messages/`. The `messages/` directory is populated at build time via MSBuild:

```xml
<!-- In the gateway .csproj -->
<ItemGroup>
    <Content Include="..\..\..\..\contracts\messages\*.json" LinkBase="messages" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

This copies all locale JSON files from `contracts/messages/` (e.g., `en-US.json`, `fr-FR.json`, `de-DE.json`, `ja-JP.json`) into the output `messages/` directory.

## Dependencies

- `D2.Shared.I18n` — `ITranslator` (translation lookup), `Translator` (JSON catalog loader), `SupportedLocales` (locale validation/resolution, `ToBcp47()` normaliser, `LanguageDefaults` map).
