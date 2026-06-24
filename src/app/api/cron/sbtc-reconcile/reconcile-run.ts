// src/app/api/cron/sbtc-reconcile/reconcile-run.ts
// Extracted from route.ts so the reconcile loop can be unit-tested without
// exporting a non-route symbol from a Next.js route file (route files may only
// export GET/POST/runtime/etc.).
import { decideNext } from "@/lib/server/sbtc-reconcile";
import type { PendingDeposit } from "@/lib/server/sbtc-pending";

export interface Deps {
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
