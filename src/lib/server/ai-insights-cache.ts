// src/lib/server/ai-insights-cache.ts
// Server-only Redis IO for the AI insights route. Mirrors push-redis.ts /
// smart-dca-redis.ts: returns null / no-ops when env is absent so the route
// degrades (regenerates every call, skips rate-limit) instead of throwing.
//
// Why Redis instead of module-level memory: on Vercel Functions module memory
// is per-instance, so an in-process cache is duplicated across concurrent
// lambdas (the "5-min cache" fires N times) and an in-process rate-limit Map
// is trivially bypassed by request fan-out. Redis is the only store shared by
// every instance.
import { Redis } from "@upstash/redis";
import type { AIInsightsResponse } from "@/lib/ai";

const CACHE_KEY = "ai-insights:v1:cache";
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes — Redis owns expiry

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 10;

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (redis !== undefined) return redis;
  try {
    redis = Redis.fromEnv();
  } catch {
    redis = null;
  }
  return redis;
}

/** Returns the cached insights if present and unexpired, else null. */
export async function getCachedInsights(): Promise<AIInsightsResponse | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    // @upstash/redis auto-deserializes JSON values written via set().
    return (await r.get<AIInsightsResponse>(CACHE_KEY)) ?? null;
  } catch {
    return null;
  }
}

/** Stores insights with a Redis-managed TTL. No-op when Redis is absent. */
export async function setCachedInsights(data: AIInsightsResponse): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(CACHE_KEY, data, { ex: CACHE_TTL_SECONDS });
  } catch {
    // best-effort cache; a write failure just means the next call regenerates
  }
}

/**
 * Fixed-window rate limit shared across all instances. Returns true when the
 * caller has exceeded RATE_LIMIT_MAX requests in the current window. Fails
 * open (returns false) when Redis is unavailable so the route stays usable.
 */
export async function isRateLimited(ip: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const key = `ai-insights:rl:${ip}`;
  try {
    const count = await r.incr(key);
    if (count === 1) {
      // First hit in this window — start the expiry clock.
      await r.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }
    return count > RATE_LIMIT_MAX;
  } catch {
    return false;
  }
}
