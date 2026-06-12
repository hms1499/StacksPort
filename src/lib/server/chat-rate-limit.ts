// src/lib/server/chat-rate-limit.ts
// Sliding-window rate limit for the uncached chat route. Mirrors
// ai-insights-cache.ts:isRateLimited — degrades to "not limited" when Redis env
// is absent so local/dev still works, since Redis is the only store shared
// across Vercel function instances.
import { Redis } from "@upstash/redis";

const WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 15;

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (redis !== undefined) return redis;
  try {
    redis = Redis.fromEnv();
  } catch {
    redis = null;
  }
  return redis;
}

/** `key` is an IP (+ address when present). Returns true once over the window cap. */
export async function isChatRateLimited(key: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const redisKey = `ai-chat:rl:${key}`;
  try {
    const count = await r.incr(redisKey);
    if (count === 1) await r.expire(redisKey, WINDOW_SECONDS);
    return count > MAX_PER_WINDOW;
  } catch {
    return false;
  }
}
