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

export type HistoryRange = "24h" | "7d" | "30d" | "all";

// Bucket sizes chosen so each range returns ≤ ~30–100 points: enough resolution
// for a sparkline / line chart, small enough that the payload stays trivial.
// bucketMs = null means "raw" — return every point in the window.
const RANGE_CONFIG: Record<
  HistoryRange,
  { windowMs: number | null; bucketMs: number | null }
> = {
  "24h": { windowMs: 24 * 60 * 60 * 1000, bucketMs: null },
  "7d": { windowMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 6 * 60 * 60 * 1000 },
  "30d": { windowMs: 30 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000 },
  all: { windowMs: null, bucketMs: 24 * 60 * 60 * 1000 },
};

function parsePoints(raw: unknown[]): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    try {
      const p = JSON.parse(item) as HistoryPoint;
      if (typeof p.t === "number" && typeof p.totalUsd === "number") out.push(p);
    } catch {
      // skip malformed
    }
  }
  return out;
}

// Last-in-bucket downsample. Net worth is a point-in-time value, so the
// closing sample of each bucket is more meaningful than an average.
function downsample(points: HistoryPoint[], bucketMs: number): HistoryPoint[] {
  if (points.length === 0) return points;
  const out: HistoryPoint[] = [];
  let currentBucket = Math.floor(points[0].t / bucketMs);
  let latest = points[0];
  for (let i = 1; i < points.length; i++) {
    const b = Math.floor(points[i].t / bucketMs);
    if (b === currentBucket) {
      latest = points[i];
    } else {
      out.push(latest);
      currentBucket = b;
      latest = points[i];
    }
  }
  out.push(latest);
  return out;
}

export interface HistoryResult {
  points: HistoryPoint[];
  firstSeenAt: number | null;
}

export async function readHistory(
  address: string,
  range: HistoryRange
): Promise<HistoryResult> {
  const redis = getRedis();
  if (!redis) return { points: [], firstSeenAt: null };

  const cfg = RANGE_CONFIG[range];
  const k = key(address);
  const min = cfg.windowMs == null ? "-inf" : Date.now() - cfg.windowMs;

  const [rangeRaw, firstRaw] = await Promise.all([
    redis.zrange<string[]>(k, min as number, "+inf", { byScore: true }),
    redis.zrange<string[]>(k, 0, 0, { withScores: true }),
  ]);

  const points = parsePoints(rangeRaw ?? []);
  const downsampled = cfg.bucketMs == null ? points : downsample(points, cfg.bucketMs);

  const firstSeenAt =
    firstRaw && firstRaw.length === 2 && Number.isFinite(Number(firstRaw[1]))
      ? Number(firstRaw[1])
      : null;

  return { points: downsampled, firstSeenAt };
}
