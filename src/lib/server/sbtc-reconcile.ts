import type { PendingDeposit } from "./sbtc-pending";
import type { EmilyDepositStatus } from "./emily-status";

export type ReconcileAction = "notify" | "mark_minted" | "expire" | "none";

const MAX_AGE_MS = 14 * 24 * 3600 * 1000;

export function decideNext(
  d: PendingDeposit,
  opts: { inMempool: boolean; emily: EmilyDepositStatus; now: number },
): ReconcileAction {
  if (opts.now - d.createdAt > MAX_AGE_MS) return "expire";
  if (d.status === "broadcast" && opts.inMempool) return "notify";
  if (d.status === "notified" && opts.emily === "confirmed") return "mark_minted";
  return "none";
}
