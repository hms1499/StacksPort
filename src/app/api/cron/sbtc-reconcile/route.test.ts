// src/app/api/cron/sbtc-reconcile/route.test.ts
import { describe, it, expect, vi } from "vitest";
import { runReconcile } from "./route";

describe("runReconcile", () => {
  it("notifies a mempool-confirmed broadcast and marks minted on Emily confirm", async () => {
    const deposits = [
      { txid: "a", stacksAddress: "SP1", amountSats: 1, status: "broadcast" as const, createdAt: Date.now(), depositScript: "d", reclaimScript: "r" },
      { txid: "b", stacksAddress: "SP2", amountSats: 1, status: "notified" as const, createdAt: Date.now(), depositScript: "d", reclaimScript: "r" },
    ];
    const updateStatus = vi.fn(); const removeDeposit = vi.fn(); const sendPush = vi.fn().mockResolvedValue(true);
    const notifySbtc = vi.fn().mockResolvedValue({});
    const out = await runReconcile({
      listAllAddresses: async () => ["SP1", "SP2"],
      listForAddress: async (a: string) => deposits.filter((d) => d.stacksAddress === a),
      updateStatus, removeDeposit, sendPush,
      sbtcClient: { fetchTxHex: async () => "hex", notifySbtc },
      emily: { getDepositStatus: async (txid: string) => (txid === "b" ? "confirmed" : "unknown") },
      inMempool: async () => true,
      invalidatePortfolio: vi.fn(),
      now: Date.now(),
    });
    expect(notifySbtc).toHaveBeenCalledOnce();
    expect(updateStatus).toHaveBeenCalledWith("SP1", "a", "notified");
    expect(sendPush).toHaveBeenCalledOnce();
    expect(removeDeposit).toHaveBeenCalledWith("SP2", "b");
    expect(out).toMatchObject({ notified: 1, minted: 1 });
  });
});
