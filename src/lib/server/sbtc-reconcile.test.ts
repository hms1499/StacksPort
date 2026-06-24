import { describe, it, expect } from "vitest";
import { decideNext } from "./sbtc-reconcile";
import type { PendingDeposit } from "./sbtc-pending";

const d = (over: Partial<PendingDeposit>): PendingDeposit => ({
  txid: "t", stacksAddress: "SP1", amountSats: 100000, status: "broadcast",
  createdAt: 1_000, depositScript: "", reclaimScript: "", ...over,
});

describe("decideNext", () => {
  it("notifies once a broadcast tx is in the mempool", () => {
    expect(decideNext(d({ status: "broadcast" }), { inMempool: true, emily: "unknown", now: 2000 })).toBe("notify");
  });
  it("waits while a broadcast tx is not yet in the mempool", () => {
    expect(decideNext(d({ status: "broadcast" }), { inMempool: false, emily: "unknown", now: 2000 })).toBe("none");
  });
  it("marks minted when Emily confirms a notified deposit", () => {
    expect(decideNext(d({ status: "notified" }), { inMempool: true, emily: "confirmed", now: 2000 })).toBe("mark_minted");
  });
  it("keeps waiting while Emily is still pending", () => {
    expect(decideNext(d({ status: "notified" }), { inMempool: true, emily: "pending", now: 2000 })).toBe("none");
  });
  it("expires anything older than 14 days", () => {
    const old = 1_000;
    const now = old + 15 * 24 * 3600 * 1000;
    expect(decideNext(d({ status: "notified", createdAt: old }), { inMempool: true, emily: "pending", now })).toBe("expire");
  });
});
