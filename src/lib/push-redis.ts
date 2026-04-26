// src/lib/push-redis.ts
import { Redis } from '@upstash/redis';

const KEY = 'push:subs';

const redis = Redis.fromEnv();

export interface PushAlertEntry {
  id: string;
  tokenSymbol: string;
  geckoId: string;
  condition: 'above' | 'below';
  targetPrice: number;
  isActive: boolean;
  lastPushedAt: number | null;
}

export interface SubEntry {
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: PushAlertEntry[];
  updatedAt: number;
}

function normalizeAddr(addr: string): string {
  return addr.toLowerCase();
}

export async function getSub(addr: string): Promise<SubEntry | null> {
  const raw = await redis.hget<SubEntry | string>(KEY, normalizeAddr(addr));
  if (raw === null || raw === undefined) return null;
  // Upstash REST may return parsed object or stringified JSON depending on how it was written.
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as SubEntry; } catch { return null; }
  }
  return raw;
}

export async function putSub(addr: string, entry: SubEntry): Promise<void> {
  await redis.hset(KEY, { [normalizeAddr(addr)]: JSON.stringify(entry) });
}

export async function deleteSub(addr: string): Promise<void> {
  await redis.hdel(KEY, normalizeAddr(addr));
}
