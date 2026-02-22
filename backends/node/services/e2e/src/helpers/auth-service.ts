import { MessageBus, type IMessagePublisher } from "@d2/messaging";
import { createApp } from "@d2/auth-api";
import { AUTH_MESSAGING } from "@d2/auth-domain";
import { createPasswordFunctions, type AuthServiceConfig, type PrefixCache } from "@d2/auth-infra";

let messageBus: MessageBus | undefined;
let publisher: IMessagePublisher | undefined;
let shutdownFn: (() => Promise<void>) | undefined;

export interface AuthServiceHandle {
  /** BetterAuth API for direct testing (no HTTP needed). */
  auth: Awaited<ReturnType<typeof createApp>>["auth"];
  /** Hono app for HTTP route testing (invitation routes, etc.). */
  app: Awaited<ReturnType<typeof createApp>>["app"];
}

/**
 * No-breach HIBP cache: returns an empty response for all prefix lookups.
 * Domain validation (length, complexity, common blocklist) still runs —
 * only the external HIBP API call is skipped.
 */
const noBreachCache = {
  get: () => "",
  set: () => {},
} as PrefixCache;

/**
 * Starts the auth service in-process using `createApp()` from `@d2/auth-api`.
 * Connects to RabbitMQ for publishing auth events (verification, password reset, invitation).
 */
export async function startAuthService(opts: {
  databaseUrl: string;
  redisUrl: string;
  rabbitMqUrl: string;
  geoAddress: string;
  geoApiKey: string;
}): Promise<AuthServiceHandle> {
  // Create RabbitMQ publisher for auth events
  messageBus = new MessageBus({
    url: opts.rabbitMqUrl,
    connectionName: "e2e-auth",
  });
  await messageBus.waitForConnection();

  publisher = await messageBus.createPublisher({
    exchanges: [{ exchange: AUTH_MESSAGING.EVENTS_EXCHANGE, type: "fanout" }],
  });

  const config: AuthServiceConfig = {
    databaseUrl: opts.databaseUrl,
    redisUrl: opts.redisUrl,
    baseUrl: "http://localhost:3333",
    corsOrigin: "http://localhost:5173",
    jwtIssuer: "e2e-test-issuer",
    jwtAudience: "e2e-test-audience",
    jwtExpirationSeconds: 900,
    passwordMinLength: 12,
    passwordMaxLength: 128,
    geoAddress: opts.geoAddress,
    geoApiKey: opts.geoApiKey,
  };

  // Skip HIBP API in E2E tests — domain validation still runs
  const passwordFunctions = createPasswordFunctions(noBreachCache);

  const { app, auth, shutdown } = await createApp(config, publisher, { passwordFunctions });
  shutdownFn = shutdown;

  return { auth, app };
}

/** Race a promise against a timeout (resolves even if inner hangs). */
function withTimeout(promise: Promise<void>, ms: number, label: string): Promise<void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) =>
      setTimeout(() => {
        console.warn(`[E2E] ${label} timed out after ${ms}ms — forcing continue`);
        resolve();
      }, ms),
    ),
  ]);
}

/**
 * Stops the auth service and closes RabbitMQ connections.
 */
export async function stopAuthService(): Promise<void> {
  if (shutdownFn) await withTimeout(shutdownFn(), 5_000, "auth shutdown");
  if (messageBus) await withTimeout(messageBus.close(), 5_000, "auth messageBus.close");
  shutdownFn = undefined;
  messageBus = undefined;
  publisher = undefined;
}
