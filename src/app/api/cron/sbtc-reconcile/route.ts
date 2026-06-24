// src/app/api/cron/sbtc-reconcile/route.ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  listAllAddresses, listForAddress, updateStatus, removeDeposit,
} from "@/lib/server/sbtc-pending";
import { makeEmilyStatusClient } from "@/lib/server/emily-status";
import { makeSbtcClient } from "@/lib/sbtc-deposit";
import { sendPushToAddress } from "@/lib/server/push-send";
import { runReconcile } from "./reconcile-run";

const LOCK_KEY = "sbtc-reconcile:run-lock";
const LOCK_TTL = 120; // seconds

let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (_redis !== undefined) return _redis;
  try { _redis = Redis.fromEnv(); } catch { _redis = null; }
  return _redis;
}

async function inMempoolReal(txid: string): Promise<boolean> {
  // Bitcoin mempool check via mempool.space (network-appropriate base).
  const base = process.env.SBTC_MEMPOOL_API_URL ?? "https://mempool.space/api";
  try {
    const res = await fetch(`${base}/tx/${txid}`, { signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch { return false; }
}

async function invalidatePortfolioReal(addr: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    await fetch(`${url}/api/portfolio/invalidate`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr }),
    });
  } catch { /* best-effort */ }
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Redis run-lock: prevent overlapping cron invocations (mirrors keeper-bot:run-lock).
  // If Redis is unconfigured (null), skip the lock and proceed (safe for local/dev).
  const r = getRedis();
  if (r) {
    const acquired = await r.set(LOCK_KEY, "1", { nx: true, ex: LOCK_TTL });
    if (!acquired) {
      return NextResponse.json({ skipped: "locked" });
    }
  }
  const client = makeSbtcClient();
  const result = await runReconcile({
    listAllAddresses, listForAddress, updateStatus, removeDeposit,
    sendPush: sendPushToAddress,
    sbtcClient: client as never,
    emily: makeEmilyStatusClient(),
    inMempool: inMempoolReal,
    invalidatePortfolio: invalidatePortfolioReal,
    now: Date.now(),
  });
  return NextResponse.json(result);
}
