// Tracks recent batch broadcasts and surfaces failures.
//
// Scope of this V1:
//   - BATCH-level only. The on-chain batch-execute-dca contract uses `match`
//     per plan, so a single bad plan doesn't revert the tx — meaning a
//     "success" tx_status can still hide N silently-failed plans. True
//     per-plan tracking would need the contract to emit a print event per
//     plan; that's a follow-up.
//   - Catches the cases that hurt most: tx aborted by post-condition,
//     contract trap, or runtime error. Those are also the cases where the
//     keeper's STX fee is burned for nothing.
//
// Storage shape (Upstash Redis list, head = most recent):
//   keeper:recent-batches → JSON entries, capped at 20

import { Redis } from "@upstash/redis";

const KEY = "keeper:recent-batches";
const MAX_ENTRIES = 20;

export type BatchStatus = "pending" | "success" | "aborted";

export interface BatchEntry {
  txid: string;
  planIds: number[];
  broadcastAt: number;
  status: BatchStatus;
  // Set when status moves off "pending"
  settledAt?: number;
  // Filled with the Hiro tx_status string when aborted, for triage
  abortReason?: string;
}

const redis = Redis.fromEnv();

export async function recordBroadcast(txid: string, planIds: number[]): Promise<void> {
  const entry: BatchEntry = {
    txid,
    planIds,
    broadcastAt: Date.now(),
    status: "pending",
  };
  await redis.lpush(KEY, JSON.stringify(entry));
  await redis.ltrim(KEY, 0, MAX_ENTRIES - 1);
}

export async function loadRecent(): Promise<BatchEntry[]> {
  const raw = (await redis.lrange<unknown>(KEY, 0, MAX_ENTRIES - 1)) ?? [];
  const out: BatchEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      try {
        out.push(JSON.parse(item) as BatchEntry);
      } catch {
        // skip malformed
      }
    } else if (item && typeof item === "object") {
      // Upstash sometimes auto-parses JSON
      out.push(item as BatchEntry);
    }
  }
  return out;
}

// Atomic-ish update: replace the whole list with the updated entries. This is
// fine because cron runs are serialized by the keeper-bot lock — there is
// only one writer at any moment.
export async function saveRecent(entries: BatchEntry[]): Promise<void> {
  const pipe = redis.multi();
  pipe.del(KEY);
  for (const e of entries.slice(0, MAX_ENTRIES)) {
    pipe.rpush(KEY, JSON.stringify(e));
  }
  await pipe.exec();
}

export function consecutiveAbortedTail(entries: BatchEntry[]): number {
  let n = 0;
  for (const e of entries) {
    if (e.status === "aborted") n++;
    else if (e.status === "success") break;
    // pending entries are skipped, they don't reset the count
  }
  return n;
}
