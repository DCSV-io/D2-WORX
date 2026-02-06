import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import { HandlerContext, type IHandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";

let container: StartedRedisContainer;
let redis: Redis;

export async function startRedis(): Promise<void> {
  container = await new RedisContainer("redis:8.2").start();
  redis = new Redis({
    host: container.getHost(),
    port: container.getFirstMappedPort(),
    lazyConnect: false,
  });
}

export async function stopRedis(): Promise<void> {
  await redis?.quit();
  await container?.stop();
}

export function getRedis(): Redis {
  return redis;
}

export async function flushRedis(): Promise<void> {
  await redis.flushall();
}

export function createTestContext(traceId?: string): IHandlerContext {
  const request: IRequestContext = {
    traceId: traceId ?? "test-trace-id",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}
