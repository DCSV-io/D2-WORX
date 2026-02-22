import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createLogger } from "@d2/logging";
import { HandlerContext } from "@d2/handler";
import * as CacheMemory from "@d2/cache-memory";
import {
  GetContactsByExtKeys,
  DEFAULT_GEO_CLIENT_OPTIONS,
  createGeoServiceClient,
  type GeoClientOptions,
} from "@d2/geo-client";
import { MessageBus } from "@d2/messaging";
import type { ChannelPreference, TemplateWrapper } from "@d2/comms-domain";
import { createDeliveryHandlers, createDeliverySubHandlers } from "@d2/comms-app";
import {
  createMessageRepoHandlers,
  createDeliveryRequestRepoHandlers,
  createDeliveryAttemptRepoHandlers,
  createChannelPreferenceRepoHandlers,
  createTemplateWrapperRepoHandlers,
  runMigrations,
  createAuthEventConsumer,
  seedDefaultTemplates,
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
 * Wires comms from app-layer factories to inject StubEmailProvider
 * while using real Geo for recipient resolution.
 *
 * Mirrors `createCommsService()` but replaces ResendEmailProvider
 * with a stub that captures emails in-memory.
 */
export async function startCommsService(opts: {
  databaseUrl: string;
  rabbitMqUrl: string;
  geoAddress: string;
  geoApiKey: string;
}): Promise<CommsServiceHandle> {
  const logger = createLogger({ serviceName: "e2e-comms", level: "warn" as never });
  const handlerContext = new HandlerContext(
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

  // 2. Repository handlers
  const repos = {
    message: createMessageRepoHandlers(db, handlerContext),
    request: createDeliveryRequestRepoHandlers(db, handlerContext),
    attempt: createDeliveryAttemptRepoHandlers(db, handlerContext),
    channelPref: createChannelPreferenceRepoHandlers(db, handlerContext),
    template: createTemplateWrapperRepoHandlers(db, handlerContext),
  };

  // 3. Stub email provider (captures emails in-memory)
  stubEmail = new StubEmailProvider(handlerContext);

  // 4. Geo client for recipient resolution (real gRPC to test Geo instance)
  const geoOptions: GeoClientOptions = {
    ...DEFAULT_GEO_CLIENT_OPTIONS,
    allowedContextKeys: ["user", "org_contact"],
    apiKey: opts.geoApiKey,
  };
  const contactCacheStore = new CacheMemory.MemoryCacheStore();
  geoClient = createGeoServiceClient(opts.geoAddress, opts.geoApiKey);
  const getContactsByExtKeys = new GetContactsByExtKeys(
    contactCacheStore,
    geoClient,
    geoOptions,
    handlerContext,
  );

  // 5. In-memory caches for channel prefs and templates
  const prefCacheStore = new CacheMemory.MemoryCacheStore();
  const tplCacheStore = new CacheMemory.MemoryCacheStore();
  const cache = {
    channelPref: {
      get: new CacheMemory.Get<ChannelPreference>(prefCacheStore, handlerContext),
      set: new CacheMemory.Set<ChannelPreference>(prefCacheStore, handlerContext),
    },
    template: {
      get: new CacheMemory.Get<TemplateWrapper>(tplCacheStore, handlerContext),
      set: new CacheMemory.Set<TemplateWrapper>(tplCacheStore, handlerContext),
    },
  };

  // 6. Delivery engine handlers (with stub email provider)
  const deliveryHandlers = createDeliveryHandlers(
    repos,
    { email: stubEmail },
    getContactsByExtKeys,
    handlerContext,
    cache,
  );

  // 7. Seed default templates (idempotent)
  await seedDefaultTemplates(repos.template, handlerContext);

  // 8. RabbitMQ consumer for auth events
  messageBus = new MessageBus({ url: opts.rabbitMqUrl, connectionName: "e2e-comms" });
  await messageBus.waitForConnection();

  const subHandlers = createDeliverySubHandlers(deliveryHandlers.deliver, handlerContext);
  await createAuthEventConsumer(messageBus, subHandlers);

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
