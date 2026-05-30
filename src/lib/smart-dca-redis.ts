// src/lib/smart-dca-redis.ts
// Server-only Redis IO for Smart DCA config. Mirrors push-redis.ts: returns
// null / no-ops when env is absent so routes degrade instead of throwing.
import { Redis } from "@upstash/redis";
import type { SmartDcaConfig } from "./smart-dca";

const CONFIG_HASH = "smart-dca:v0:config";
const DEFER_HASH = "smart-dca:v0:defer";

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (redis !== undefined) return redis;
  try { redis = Redis.fromEnv(); } catch { redis = null; }
  return redis;
}

function parse(raw: unknown): SmartDcaConfig | null {
  let obj: unknown = raw;
  if (typeof raw === "string") { try { obj = JSON.parse(raw); } catch { return null; } }
  if (!obj || typeof obj !== "object") return null;
  const c = obj as Record<string, unknown>;
  if (
    typeof c.owner !== "string" || typeof c.thresholdBps !== "number" ||
    typeof c.windowDays !== "number" || typeof c.maxDeferIntervals !== "number"
  ) return null;
  return {
    owner: c.owner,
    thresholdBps: c.thresholdBps,
    windowDays: c.windowDays,
    maxDeferIntervals: c.maxDeferIntervals,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : 0,
  };
}

export interface SmartDcaConfigView extends SmartDcaConfig {
  planId: number;
}

export async function getConfigsForOwner(owner: string): Promise<SmartDcaConfigView[]> {
  const client = getRedis();
  if (!client) return [];
  const raw = await client.hgetall<Record<string, unknown>>(CONFIG_HASH);
  if (!raw) return [];
  const lower = owner.toLowerCase();
  const out: SmartDcaConfigView[] = [];
  for (const [field, v] of Object.entries(raw)) {
    const cfg = parse(v);
    const planId = Number(field);
    if (cfg && Number.isFinite(planId) && cfg.owner.toLowerCase() === lower) {
      out.push({ planId, ...cfg });
    }
  }
  return out;
}

export async function putConfig(planId: number, cfg: SmartDcaConfig): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.hset(CONFIG_HASH, { [String(planId)]: JSON.stringify(cfg) });
}

// Removing a config also clears its defer counter so a future re-enable starts clean.
export async function deleteConfig(planId: number): Promise<void> {
  const client = getRedis();
  if (!client) return;
  await client.hdel(CONFIG_HASH, String(planId));
  await client.hdel(DEFER_HASH, String(planId));
}

// Ownership guard for mutations: returns the stored config for a plan, or null.
export async function getConfig(planId: number): Promise<SmartDcaConfig | null> {
  const client = getRedis();
  if (!client) return null;
  const raw = await client.hget<unknown>(CONFIG_HASH, String(planId));
  return parse(raw ?? null);
}
