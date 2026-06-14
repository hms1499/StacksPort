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
import type { PortfolioInsightsResponse } from "@/lib/ai-portfolio";
import { AI_LOCALES } from "./ai-language";

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

// Insights are localized per UI language (the model writes summaries in the
// user's locale), so the cache is keyed by locale — otherwise the first-cached
// language would be served to everyone for the next 5 minutes.
const insightsKey = (locale: string) => `${CACHE_KEY}:${locale}`;

/** Returns the cached insights for `locale` if present and unexpired, else null. */
export async function getCachedInsights(
  locale: string
): Promise<AIInsightsResponse | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    // @upstash/redis auto-deserializes JSON values written via set().
    return (await r.get<AIInsightsResponse>(insightsKey(locale))) ?? null;
  } catch {
    return null;
  }
}

/** Stores insights for `locale` with a Redis-managed TTL. No-op without Redis. */
export async function setCachedInsights(
  locale: string,
  data: AIInsightsResponse
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(insightsKey(locale), data, { ex: CACHE_TTL_SECONDS });
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

const PORTFOLIO_CACHE_PREFIX = "ai-portfolio:v1:";
const PORTFOLIO_CACHE_TTL_SECONDS = 12 * 60; // 12 minutes

// Personal alerts are phrased by the model in the UI language, so the cache is
// keyed per address AND locale.
const portfolioKey = (address: string, locale: string) =>
  `${PORTFOLIO_CACHE_PREFIX}${address}:${locale}`;

export async function getCachedPortfolioInsights(
  address: string,
  locale: string
): Promise<PortfolioInsightsResponse | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return (await r.get<PortfolioInsightsResponse>(portfolioKey(address, locale))) ?? null;
  } catch {
    return null;
  }
}

export async function setCachedPortfolioInsights(
  address: string,
  locale: string,
  data: PortfolioInsightsResponse
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(portfolioKey(address, locale), data, { ex: PORTFOLIO_CACHE_TTL_SECONDS });
  } catch {
    // best-effort
  }
}

/** Bust a wallet's cached alerts across all locales (called after a tx confirms). */
export async function deleteCachedPortfolioInsights(address: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    // No wildcard del on Upstash without a scan — fan out over the known locales.
    await Promise.all(AI_LOCALES.map((loc) => r.del(portfolioKey(address, loc))));
  } catch {
    // best-effort
  }
}

/** Fixed-window rate limit keyed by wallet address. Fails open without Redis. */
export async function isPortfolioRateLimited(address: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const key = `ai-portfolio:rl:${address}`;
  try {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    return count > RATE_LIMIT_MAX;
  } catch {
    return false;
  }
}
