import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import Redis from "ioredis";
import { HandlerContext, type IRequestContext } from "@d2/handler";
import { createLogger } from "@d2/logging";

let container: StartedRedisContainer;
let redis: Redis;

export async function startRedis(): Promise<void> {
  container = await new RedisContainer("redis:8.2").start();
  redis = new Redis(container.getConnectionUrl());
}

export async function stopRedis(): Promise<void> {
  await redis?.quit();
  await container?.stop();
}

export function getRedis(): Redis {
  return redis;
}

export function getRedisUrl(): string {
  return container.getConnectionUrl();
}

export async function flushRedis(): Promise<void> {
  await redis.flushall();
}

export function createTestContext(): HandlerContext {
  const request: IRequestContext = {
    traceId: "trace-redis-integration",
    isAuthenticated: false,
    isAgentStaff: false,
    isAgentAdmin: false,
    isTargetingStaff: false,
    isTargetingAdmin: false,
  };
  return new HandlerContext(request, createLogger({ level: "silent" as never }));
}
