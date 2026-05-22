import { loadRecent, saveRecent, consecutiveAbortedTail, type BatchEntry } from "./failure-tracker.js";
import { notifyBatchAborted, notifyConsecutiveAborts } from "./telegram-notify.js";
import { log } from "./logger.js";

// Tx must be at least this old before we ask Hiro for status. Hiro's mempool
// index can lag a few seconds behind broadcast; querying too early returns
// "not_found" and we'd misinterpret it.
const SETTLE_GRACE_MS = 30_000;

// 3 consecutive aborts → page operator. Lower than this and a flaky block
// would spam. Higher and a real outage takes too long to surface.
const ABORT_PAGE_THRESHOLD = 3;

type HiroTxStatus =
  | "pending"
  | "success"
  | "abort_by_response"
  | "abort_by_post_condition"
  | "dropped_replace_by_fee"
  | "dropped_problematic"
  | "dropped_stale_garbage_collect"
  | "not_found";

async function fetchTxStatus(hiroBase: string, txid: string): Promise<HiroTxStatus> {
  try {
    const res = await fetch(`${hiroBase}/extended/v1/tx/${txid}`);
    if (res.status === 404) return "not_found";
    if (!res.ok) return "pending";
    const data = (await res.json()) as { tx_status?: HiroTxStatus };
    return data.tx_status ?? "pending";
  } catch {
    return "pending";
  }
}

function isAbort(status: HiroTxStatus): boolean {
  return status.startsWith("abort_") || status.startsWith("dropped_");
}

/**
 * Walk recent batches, resolve any pending ones whose tx has settled, alert
 * on aborts. Called at the start of each cron run before scanning new plans.
 *
 * Idempotent: re-running is safe — already-settled entries are untouched and
 * Telegram dedup happens via the status transition (pending → aborted fires
 * once, subsequent runs see "aborted" and skip).
 */
export async function reconcileRecentBatches(hiroBase: string): Promise<void> {
  const entries = await loadRecent();
  if (entries.length === 0) return;

  let dirty = false;
  const newlyAborted: BatchEntry[] = [];

  for (const entry of entries) {
    if (entry.status !== "pending") continue;
    if (Date.now() - entry.broadcastAt < SETTLE_GRACE_MS) continue;

    const status = await fetchTxStatus(hiroBase, entry.txid);
    if (status === "pending" || status === "not_found") continue;

    if (isAbort(status)) {
      entry.status = "aborted";
      entry.abortReason = status;
      newlyAborted.push(entry);
    } else if (status === "success") {
      entry.status = "success";
    } else {
      continue;
    }
    entry.settledAt = Date.now();
    dirty = true;
  }

  if (dirty) await saveRecent(entries);

  for (const entry of newlyAborted) {
    log.warn("Batch aborted on-chain", {
      txid: entry.txid,
      reason: entry.abortReason,
      planCount: entry.planIds.length,
    });
    await notifyBatchAborted(entry).catch((err) =>
      log.warn("telegram abort notify failed", { err: String(err) })
    );
  }

  const tail = consecutiveAbortedTail(entries);
  if (tail >= ABORT_PAGE_THRESHOLD && newlyAborted.length > 0) {
    // Only page when this run flipped at least one new entry to aborted —
    // re-running cron after a manual fix shouldn't keep paging.
    await notifyConsecutiveAborts(tail).catch((err) =>
      log.warn("telegram page notify failed", { err: String(err) })
    );
  }
}
