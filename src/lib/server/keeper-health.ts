// Mirrors the shape written by keeper-bot/src/failure-tracker.ts. The two
// processes don't share code — keeper-bot is an ESM-only node module under
// keeper-bot/, the Next app is bundled separately — so the contract lives
// in two places. Keep these in sync.

import { Redis } from "@upstash/redis";

const RECENT_BATCHES_KEY = "keeper:recent-batches";
const HEARTBEAT_KEY = "keeper:last-run";
const MAX_ENTRIES = 20;

export type BatchStatus = "pending" | "success" | "aborted";

export interface BatchEntry {
  txid: string;
  planIds: number[];
  broadcastAt: number;
  status: BatchStatus;
  settledAt?: number;
  abortReason?: string;
}

export interface RunHeartbeat {
  finishedAt: number;
  planCount: number;
  chunkCount: number;
  exitCode: number;
}

const redis = Redis.fromEnv();

export async function readRecentBatches(): Promise<BatchEntry[]> {
  const raw = (await redis.lrange<unknown>(RECENT_BATCHES_KEY, 0, MAX_ENTRIES - 1)) ?? [];
  const out: BatchEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      try {
        out.push(JSON.parse(item) as BatchEntry);
      } catch {
        // skip malformed
      }
    } else if (item && typeof item === "object") {
      out.push(item as BatchEntry);
    }
  }
  return out;
}

export async function readHeartbeat(): Promise<RunHeartbeat | null> {
  const raw = await redis.get<RunHeartbeat | string | null>(HEARTBEAT_KEY);
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as RunHeartbeat;
    } catch {
      return null;
    }
  }
  return raw;
}

export interface KeeperHealth {
  ok: boolean;
  lastRun: RunHeartbeat | null;
  lastRunAgoSeconds: number | null;
  recentBatches: {
    total: number;
    pending: number;
    success: number;
    aborted: number;
    consecutiveAbortedTail: number;
  };
  // Most-recent first, capped at 5 for readable JSON
  latestEntries: BatchEntry[];
}

function consecutiveAbortedTail(entries: BatchEntry[]): number {
  let n = 0;
  for (const e of entries) {
    if (e.status === "aborted") n++;
    else if (e.status === "success") break;
  }
  return n;
}

// Two pieces inform the `ok` flag:
//   1. Last-run heartbeat is within the freshness window (cron is alive).
//   2. The consecutive-aborted tail is below the page threshold (recent
//      broadcasts are landing).
// Configurable via the Next app's env, with defaults that match the cron
// cadence + 50% slack.
const DEFAULT_MAX_RUN_AGE_SECONDS = 15 * 60;
const DEFAULT_ABORT_TAIL_LIMIT = 3;

export async function getKeeperHealth(): Promise<KeeperHealth> {
  const [hb, entries] = await Promise.all([readHeartbeat(), readRecentBatches()]);

  const maxRunAge = Number(process.env.KEEPER_HEALTH_MAX_RUN_AGE_SECONDS ?? DEFAULT_MAX_RUN_AGE_SECONDS);
  const tailLimit = Number(process.env.KEEPER_HEALTH_ABORT_TAIL_LIMIT ?? DEFAULT_ABORT_TAIL_LIMIT);

  const lastRunAgoSeconds = hb ? Math.floor((Date.now() - hb.finishedAt) / 1000) : null;
  const tail = consecutiveAbortedTail(entries);

  const recent = {
    total: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    success: entries.filter((e) => e.status === "success").length,
    aborted: entries.filter((e) => e.status === "aborted").length,
    consecutiveAbortedTail: tail,
  };

  const fresh = lastRunAgoSeconds !== null && lastRunAgoSeconds <= maxRunAge;
  const healthy = fresh && tail < tailLimit;

  return {
    ok: healthy,
    lastRun: hb,
    lastRunAgoSeconds,
    recentBatches: recent,
    latestEntries: entries.slice(0, 5),
  };
}
