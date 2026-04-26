// keeper-bot/src/redis-store.ts
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

export async function readAllSubs(): Promise<Record<string, SubEntry>> {
  const raw = await redis.hgetall<Record<string, SubEntry | string>>(KEY);
  if (!raw) return {};
  const out: Record<string, SubEntry> = {};
  for (const [addr, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      try { out[addr] = JSON.parse(v) as SubEntry; } catch { /* skip malformed */ }
    } else if (v && typeof v === 'object') {
      out[addr] = v as SubEntry;
    }
  }
  return out;
}

export async function writeSub(addr: string, entry: SubEntry): Promise<void> {
  await redis.hset(KEY, { [normalizeAddr(addr)]: JSON.stringify(entry) });
}

export async function deleteSub(addr: string): Promise<void> {
  await redis.hdel(KEY, normalizeAddr(addr));
}
