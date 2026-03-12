# @d2/auth-bff-client — Auth BFF Client Library

Backend-only auth client for the SvelteKit BFF (Backend-for-Frontend) proxy pattern. Handles session resolution, JWT lifecycle, and route protection by communicating with the Auth service over HTTP.

## Architecture

```
Browser ──cookie──► SvelteKit Server ──HTTP──► Auth Service (port 5100)
                         │
                    session resolved in hooks.server.ts
                    JWT obtained for gateway calls (future)
                         │
                    route guards via +layout.server.ts
```

- **Session cookies**: `better-auth.session_token` (signed, httpOnly, sameSite: lax) + `better-auth.session_data` (cookie cache, 5min TTL)
- **Session resolution**: Forwards cookies to Auth service `GET /api/auth/get-session`
- **Auth proxy**: Catch-all route at `/api/auth/[...path]` forwards all auth requests
- **JWTs**: For future gateway calls — manages token lifecycle (obtain, cache, refresh)

### Cookie Signing

BetterAuth cookie values are **signed** (`TOKEN.SIGNATURE`), not raw tokens. The raw token from `auth.api.signInEmail()` works with `Authorization: Bearer` but **cannot** be used as a cookie value — BetterAuth silently returns null for unsigned cookies. See AUTH.md § "Cookie Signing & Token Types" for full details.

## Why HTTP Proxy (not local BetterAuth)

A local BetterAuth instance in SvelteKit would bypass the Auth service's security middleware — rate limiting, fingerprint binding, throttle tracking, sign-in event recording. The proxy pattern ensures ALL auth requests flow through the Auth service's full pipeline.

## Public API

### Types

| Type                         | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| `AuthSession`                | Resolved session data (userId, org context, emulation)   |
| `AuthUser`                   | Resolved user data (id, email, name, username, image)    |
| `AuthBffConfig`              | Configuration (authServiceUrl, timeout, apiKey)          |
| `AuthenticatedLocals`        | Narrowed type after `requireAuth()`                      |
| `AuthenticatedWithOrgLocals` | Narrowed type after `requireOrg()` — org fields non-null |

### Classes

#### `SessionResolver`

Resolves the current user session from the Auth service.

```typescript
const resolver = new SessionResolver(config, logger);
const { session, user } = await resolver.resolve(request);
```

- Forwards `cookie`, `x-client-fingerprint`, and `x-api-key` (when configured) headers
- **Fail-closed**: Any error → `{ session: null, user: null }` + warning log
- No caching: Session resolution is per-request (Auth service handles cookie cache)

#### `JwtManager`

Manages JWT lifecycle for server-to-server gateway calls.

```typescript
const manager = new JwtManager(config, logger);
const token = await manager.getToken(sessionCookie);
manager.invalidate(); // Clear cache on sign-out
```

- Caches JWT in memory (never localStorage — XSS risk)
- Auto-refreshes before 15-minute expiry (refresh at ~12 minutes)
- Thread-safe: concurrent requests share the same pending refresh promise
- **Not wired into hooks yet** — prepared for Step 6 gateway integration

#### `AuthProxy`

Proxies auth requests from SvelteKit to the Auth service.

```typescript
const proxy = new AuthProxy(config, logger);
const response = await proxy.proxyRequest(event);
```

- Forwards: cookie, content-type, x-client-fingerprint, x-api-key (when configured), user-agent, accept, origin, referer
- Preserves `set-cookie` headers in response (critical for session management)
- Returns 503 on timeout/network error

### Route Guards

```typescript
import { requireAuth, requireOrg, redirectIfAuthenticated } from "@d2/auth-bff-client";

// In (auth)/+layout.server.ts — redirect signed-in users
redirectIfAuthenticated(locals);

// In (onboarding)/+layout.server.ts — require authentication
const { session, user } = requireAuth(locals);

// In (app)/+layout.server.ts — require auth + active org
const { session } = requireOrg(locals);
// session.activeOrganizationId is guaranteed non-null
```

## Configuration

| Env Var                   | Required | Default | Description                                                       |
| ------------------------- | -------- | ------- | ----------------------------------------------------------------- |
| `SVELTEKIT_AUTH__URL`     | Yes      | —       | Auth service URL. Hard-fails on startup if missing                |
| `SVELTEKIT_AUTH__API_KEY` | No       | —       | S2S API key. When set, sent as `X-Api-Key` for trusted service ID |

## Dependencies

| Package         | Type | Purpose                       |
| --------------- | ---- | ----------------------------- |
| `@d2/logging`   | dep  | Structured warning/error logs |
| `@sveltejs/kit` | peer | `redirect()`, `RequestEvent`  |

No BetterAuth dependency — this package only speaks HTTP to the Auth service.

## Testing

40 unit tests covering all four modules:

- **session-resolver** (13 tests): Success, 401, network error, header forwarding, optional fields, identity validation, unsigned cookie detection, S2S api key
- **jwt-manager** (10 tests): Obtain, cache, refresh, dedup, invalidate, error handling, S2S api key
- **auth-proxy** (7 tests): GET/POST proxy, set-cookie preservation, timeout, query params, S2S api key
- **route-guard** (10 tests): requireAuth, requireOrg, redirectIfAuthenticated

10 E2E integration tests in `backends/node/services/e2e/src/e2e/bff-client.test.ts` (real Auth service over HTTP).

Run unit tests: `cd backends/node/services/auth/bff-client && pnpm test`
Run E2E tests: `pnpm vitest --project e2e-tests run src/e2e/bff-client.test.ts`
