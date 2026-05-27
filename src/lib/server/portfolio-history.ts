import { Redis } from "@upstash/redis";
import type { TokenWithValue } from "@/lib/stacks";

// Per-address sorted set: score = epoch ms, member = JSON HistoryPoint.
// Lazy-written from getPortfolioSnapshot; no cron, no backfill.
const KEY_PREFIX = "portfolio:history:";
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// Dedup window. We want roughly hourly granularity but don't want a user who
// refreshes at minute 59 and again at minute 61 to record two adjacent points,
// so we cut slightly below 1h.
const MIN_INTERVAL_MS = 55 * 60 * 1000;

export interface HistoryPoint {
  t: number;
  totalUsd: number;
  stxUsd: number;
  sbtcUsd: number;
}

function key(address: string): string {
  return `${KEY_PREFIX}${address}`;
}

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

function sbtcValueUsd(tokens: TokenWithValue[]): number {
  const sbtc = tokens.find((t) => t.contractId.endsWith(".sbtc-token"));
  return sbtc?.valueUsd ?? 0;
}

export async function recordSnapshot(
  address: string,
  stx: TokenWithValue | null,
  tokens: TokenWithValue[],
  totalUsd: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  if (totalUsd <= 0) return;

  const now = Date.now();
  const k = key(address);

  // Peek latest score; skip if we already wrote one inside the dedup window.
  const latest = (await redis.zrange<string[]>(k, -1, -1, { withScores: true })) ?? [];
  if (latest.length === 2) {
    const lastScore = Number(latest[1]);
    if (Number.isFinite(lastScore) && now - lastScore < MIN_INTERVAL_MS) return;
  }

  const point: HistoryPoint = {
    t: now,
    totalUsd,
    stxUsd: stx?.valueUsd ?? 0,
    sbtcUsd: sbtcValueUsd(tokens),
  };

  await redis.zadd(k, { score: now, member: JSON.stringify(point) });
  await redis.zremrangebyscore(k, 0, now - RETENTION_MS);
}
