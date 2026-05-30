// keeper-bot/src/smart-dca-store.ts
// Redis IO for Smart DCA config + defer counter. IO is thin (mirrors
// redis-store.ts); the testable parts are the pure key/parse helpers below.
import { Redis } from "@upstash/redis";
import type { SmartDcaConfig } from "./smart-dca.js";

const CONFIG_HASH = "smart-dca:v0:config"; // field = planId, value = JSON config
const DEFER_HASH  = "smart-dca:v0:defer";  // field = planId, value = integer

let _redis: Redis | null = null;
function redisClient(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

export function parseConfig(raw: unknown): SmartDcaConfig | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== "object") return null;
  const c = obj as Record<string, unknown>;
  if (
    typeof c.owner !== "string" ||
    typeof c.thresholdBps !== "number" ||
    typeof c.windowDays !== "number" ||
    typeof c.maxDeferIntervals !== "number"
  ) return null;
  return {
    owner: c.owner,
    thresholdBps: c.thresholdBps,
    windowDays: c.windowDays,
    maxDeferIntervals: c.maxDeferIntervals,
    createdAt: typeof c.createdAt === "number" ? c.createdAt : 0,
  };
}

export function parseDefer(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : (raw as number);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// Returns Map<planId, config> for all configured vault-0 plans.
export async function readAllConfigs(): Promise<Map<number, SmartDcaConfig>> {
  const raw = await redisClient().hgetall<Record<string, unknown>>(CONFIG_HASH);
  const out = new Map<number, SmartDcaConfig>();
  if (!raw) return out;
  for (const [field, v] of Object.entries(raw)) {
    const cfg = parseConfig(v);
    const id = Number(field);
    if (cfg && Number.isFinite(id)) out.set(id, cfg);
  }
  return out;
}

export async function readAllDefers(): Promise<Map<number, number>> {
  const raw = await redisClient().hgetall<Record<string, unknown>>(DEFER_HASH);
  const out = new Map<number, number>();
  if (!raw) return out;
  for (const [field, v] of Object.entries(raw)) {
    const id = Number(field);
    if (Number.isFinite(id)) out.set(id, parseDefer(v));
  }
  return out;
}

// Persist defer values produced by decideBatch. Writes each field individually
// so a single bad field can't lose the rest.
export async function writeDefers(deferWrites: Map<number, number>): Promise<void> {
  for (const [planId, value] of deferWrites) {
    await redisClient().hset(DEFER_HASH, { [String(planId)]: String(value) });
  }
}
