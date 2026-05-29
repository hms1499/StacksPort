// src/lib/push-redis.ts
import { Redis } from '@upstash/redis';

const KEY = 'push:subs';

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

export interface PushAlertEntry {
  id: string;
  tokenSymbol: string;
  geckoId: string;
  condition: 'above' | 'below';
  targetPrice: number;
  isActive: boolean;
  lastPushedAt: number | null;
  // Set by the server-side evaluator when the alert fires once. Used by the
  // client UI to show "triggered at HH:MM" instead of leaving the alert in a
  // confusing always-active state.
  triggeredAt?: number;
}

export interface SubEntry {
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: PushAlertEntry[];
  // DCA plan IDs thuộc về wallet này — dùng để keeper bot reverse-lookup
  // và gửi Web Push khi plans được execute.
  planIds?: number[];
  updatedAt: number;
}

function normalizeAddr(addr: string): string {
  return addr.toLowerCase();
}

export async function getSub(addr: string): Promise<SubEntry | null> {
  const client = getRedis();
  if (!client) return null;
  const raw = await client.hget<SubEntry | string>(KEY, normalizeAddr(addr));
  if (raw === null || raw === undefined) return null;
  // Upstash REST may return parsed object or stringified JSON depending on how it was written.
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as SubEntry; } catch { return null; }
  }
  return raw;
}

export async function putSub(addr: string, entry: SubEntry): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.hset(KEY, { [normalizeAddr(addr)]: JSON.stringify(entry) });
}

export async function deleteSub(addr: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.hdel(KEY, normalizeAddr(addr));
}
