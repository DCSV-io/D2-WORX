import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createLogger, type ILogger } from "@d2/logging";
import { ILoggerKey } from "@d2/logging";
import { HandlerContext, IHandlerContextKey, IRequestContextKey } from "@d2/handler";
import type { IRequestContext } from "@d2/handler";
import { ServiceCollection, type ServiceProvider, type ServiceScope } from "@d2/di";
import * as CacheMemory from "@d2/cache-memory";
import {
  GetContactsByIds,
  IGetContactsByIdsKey,
  createGeoServiceClient,
} from "@d2/geo-client";
import { MessageBus } from "@d2/messaging";
import { IEmailProviderKey } from "@d2/comms-app";
import { addCommsApp } from "@d2/comms-app";
import {
  addCommsInfra,
  runMigrations,
  createNotificationConsumer,
  declareRetryTopology,
} from "@d2/comms-infra";
import { StubEmailProvider } from "./stub-email-provider.js";

let pool: pg.Pool | undefined;
let messageBus: MessageBus | undefined;
let stubEmail: StubEmailProvider | undefined;
let geoClient: ReturnType<typeof createGeoServiceClient> | undefined;

export interface CommsServiceHandle {
  /** Stub email provider — check captured emails with `.getSentEmails()`. */
  stubEmail: StubEmailProvider;
  /** Comms database pool for assertions. */
  pool: pg.Pool;
}

/**
 * Creates a disposable DI scope with a fresh traceId and no auth context.
 * Mirrors the production composition root's `createServiceScope`.
 */
function createServiceScope(provider: ServiceProvider): ServiceScope {
  const scope = provider.createScope();
  const requestContext: IRequestContext = {
    traceId: crypto.randomUUID(),
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
    isOrgEmulating: false,
    isUserImpersonating: false,
  };
  scope.setInstance(IRequestContextKey, requestContext);
  scope.setInstance(
    IHandlerContextKey,
    new HandlerContext(requestContext, provider.resolve(ILoggerKey)),
  );
  return scope;
}

/**
 * Wires comms via DI (mirrors production composition root) but injects
 * StubEmailProvider so E2E tests can inspect captured emails.
 */
export async function startCommsService(opts: {
  databaseUrl: string;
  rabbitMqUrl: string;
  geoAddress: string;
  geoApiKey: string;
}): Promise<CommsServiceHandle> {
  const logger: ILogger = createLogger({ serviceName: "e2e-comms", level: "warn" as never });

  // Service-level HandlerContext for pre-scope singletons (geo-client cache)
  const serviceContext = new HandlerContext(
    {
      isAuthenticated: false,
      isAgentStaff: false,
      isAgentAdmin: false,
      isTargetingStaff: false,
      isTargetingAdmin: false,
      isOrgEmulating: false,
      isUserImpersonating: false,
    },
    logger,
  );

  // 1. Database
  pool = new pg.Pool({ connectionString: opts.databaseUrl });
  await runMigrations(pool);
  const db = drizzle(pool);

  // 2. Build ServiceCollection (mirrors production composition root)
  const services = new ServiceCollection();

  // Logger — singleton (pre-built instance)
  services.addInstance(ILoggerKey, logger);

  // IHandlerContext — scoped (new per message, built from IRequestContext + logger)
  services.addScoped(
    IHandlerContextKey,
    (sp) => new HandlerContext(sp.resolve(IRequestContextKey), sp.resolve(ILoggerKey)),
  );

  // Geo client for recipient resolution (GetContactsByIds only)
  const contactCacheStore = new CacheMemory.MemoryCacheStore();
  geoClient = createGeoServiceClient(opts.geoAddress, opts.geoApiKey);
  const getContactsByIds = new GetContactsByIds(contactCacheStore, geoClient, serviceContext);
  services.addInstance(IGetContactsByIdsKey, getContactsByIds);

  // Stub email provider (captures emails in-memory)
  stubEmail = new StubEmailProvider(serviceContext);
  services.addInstance(IEmailProviderKey, stubEmail);

  // Layer registrations (mirrors services.AddCommsInfra(), services.AddCommsApp())
  addCommsInfra(services, db, {});
  addCommsApp(services);

  // 3. Build ServiceProvider
  const provider = services.build();

  // 4. RabbitMQ notification consumer (per-message scope + DLX retry topology)
  messageBus = new MessageBus({ url: opts.rabbitMqUrl, connectionName: "e2e-comms" });
  await messageBus.waitForConnection();

  // Declare retry topology (tier queues + requeue exchange) before starting consumer
  await declareRetryTopology(messageBus);

  // Retry publisher for re-publishing failed messages to tier queues
  const retryPublisher = messageBus.createPublisher();

  createNotificationConsumer({
    messageBus,
    provider,
    createScope: createServiceScope,
    retryPublisher,
    logger,
  });

  return { stubEmail, pool };
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
 * Stops the comms service and closes connections.
 */
export async function stopCommsService(): Promise<void> {
  if (messageBus) await withTimeout(messageBus.close(), 5_000, "comms messageBus.close");
  if (geoClient) (geoClient as unknown as { close(): void }).close();
  if (pool) await withTimeout(pool.end(), 5_000, "comms pool.end");
  messageBus = undefined;
  geoClient = undefined;
  pool = undefined;
}
