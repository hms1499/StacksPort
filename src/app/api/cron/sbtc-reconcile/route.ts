// src/app/api/cron/sbtc-reconcile/route.ts
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  listAllAddresses, listForAddress, updateStatus, removeDeposit, type PendingDeposit,
} from "@/lib/server/sbtc-pending";
import { decideNext } from "@/lib/server/sbtc-reconcile";
import { makeEmilyStatusClient } from "@/lib/server/emily-status";
import { makeSbtcClient } from "@/lib/sbtc-deposit";
import { sendPushToAddress } from "@/lib/server/push-send";

const LOCK_KEY = "sbtc-reconcile:run-lock";
const LOCK_TTL = 120; // seconds

let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (_redis !== undefined) return _redis;
  try { _redis = Redis.fromEnv(); } catch { _redis = null; }
  return _redis;
}

interface Deps {
  listAllAddresses: () => Promise<string[]>;
  listForAddress: (a: string) => Promise<PendingDeposit[]>;
  updateStatus: (a: string, txid: string, s: PendingDeposit["status"]) => Promise<void> | void;
  removeDeposit: (a: string, txid: string) => Promise<void> | void;
  sendPush: (addr: string, p: { title: string; body: string; url?: string }) => Promise<boolean>;
  sbtcClient: { fetchTxHex: (txid: string) => Promise<string>; notifySbtc: (arg: unknown) => Promise<unknown> };
  emily: { getDepositStatus: (txid: string) => Promise<string> };
  inMempool: (txid: string) => Promise<boolean>;
  invalidatePortfolio: (addr: string) => Promise<void> | void;
  now: number;
}

export async function runReconcile(d: Deps) {
  let processed = 0, notified = 0, minted = 0, expired = 0;
  const addresses = await d.listAllAddresses();
  for (const addr of addresses) {
    for (const dep of await d.listForAddress(addr)) {
      processed++;
      const action = decideNext(dep, {
        inMempool: await d.inMempool(dep.txid),
        emily: (await d.emily.getDepositStatus(dep.txid)) as never,
        now: d.now,
      });
      if (action === "notify") {
        const transaction = await d.sbtcClient.fetchTxHex(dep.txid);
        await d.sbtcClient.notifySbtc({ transaction, depositScript: dep.depositScript, reclaimScript: dep.reclaimScript });
        await d.updateStatus(addr, dep.txid, "notified");
        notified++;
      } else if (action === "mark_minted") {
        await d.sendPush(addr, { title: "sBTC received ✓", body: "Your BTC deposit has been minted to sBTC.", url: "/assets" });
        await d.invalidatePortfolio(addr);
        await d.removeDeposit(addr, dep.txid);
        minted++;
      } else if (action === "expire") {
        await d.removeDeposit(addr, dep.txid);
        expired++;
      }
    }
  }
  return { processed, notified, minted, expired };
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
