// src/lib/server/sbtc-pending.ts
import { Redis } from "@upstash/redis";

export type DepositStatus = "broadcast" | "notified" | "minted" | "expired";

export interface PendingDeposit {
  txid: string;
  stacksAddress: string;
  amountSats: number;
  status: DepositStatus;
  createdAt: number;
  depositScript: string;
  reclaimScript: string;
}

const PREFIX = "sbtc:pending:";
const TTL_SECONDS = 7 * 24 * 60 * 60;

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (redis !== undefined) return redis;
  try { redis = Redis.fromEnv(); } catch { redis = null; }
  return redis;
}

const keyFor = (addr: string) => `${PREFIX}${addr}`;

export async function addPending(d: PendingDeposit): Promise<void> {
  const r = getRedis(); if (!r) return;
  await r.hset(keyFor(d.stacksAddress), { [d.txid]: JSON.stringify(d) });
  await r.expire(keyFor(d.stacksAddress), TTL_SECONDS);
}

function parse(raw: Record<string, string> | null): PendingDeposit[] {
  if (!raw) return [];
  return Object.values(raw).map((v) => (typeof v === "string" ? JSON.parse(v) : v));
}

export async function listForAddress(addr: string): Promise<PendingDeposit[]> {
  const r = getRedis(); if (!r) return [];
  return parse(await r.hgetall(keyFor(addr)));
}

export async function listAllAddresses(): Promise<string[]> {
  const r = getRedis(); if (!r) return [];
  const keys = await r.keys(`${PREFIX}*`);
  return keys.map((k) => k.slice(PREFIX.length));
}

export async function updateStatus(addr: string, txid: string, status: DepositStatus): Promise<void> {
  const r = getRedis(); if (!r) return;
  const list = await listForAddress(addr);
  const found = list.find((d) => d.txid === txid);
  if (!found) return;
  await r.hset(keyFor(addr), { [txid]: JSON.stringify({ ...found, status }) });
}

export async function removeDeposit(addr: string, txid: string): Promise<void> {
  const r = getRedis(); if (!r) return;
  await r.hdel(keyFor(addr), txid);
}
