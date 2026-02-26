import IORedis from "ioredis";
import { logger } from "@/lib/logger";

const globalForRedis = globalThis as unknown as {
  redis?: IORedis;
  redisListenersBound?: boolean;
  redisReadyLogged?: boolean;
};

export function getRedisConnection() {
  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const redisUrl = process.env.REDIS_URL?.trim() || "redis://localhost:6379";

  const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  if (!globalForRedis.redisListenersBound) {
    redis.on("ready", () => {
      if (!globalForRedis.redisReadyLogged) {
        logger.info("Redis connection established", {
          redisUrl,
        });
        globalForRedis.redisReadyLogged = true;
      }
    });

    redis.on("error", (error) => {
      logger.error("Redis connection error", error, {
        redisUrl,
      });
    });

    globalForRedis.redisListenersBound = true;
  }

  globalForRedis.redis = redis;
  return redis;
}

export async function ensureRedisConnection() {
  const redis = getRedisConnection();

  if (redis.status === "ready") {
    return redis;
  }

  if (redis.status === "wait") {
    await redis.connect();
    return redis;
  }

  if (redis.status === "connecting" || redis.status === "reconnecting") {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        redis.off("error", onError);
        resolve();
      };
      const onError = (error: unknown) => {
        redis.off("ready", onReady);
        reject(error);
      };

      redis.once("ready", onReady);
      redis.once("error", onError);
    });
    return redis;
  }

  await redis.connect();
  return redis;
}
