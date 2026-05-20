// keeper-bot/src/dca-push.ts
// Gửi Web Push đến wallet owners sau khi keeper bot execute DCA plans thành công.
// Flow: batch broadcast → reverse-lookup planId→wallet trong Redis → sendNotification.

import webpush from 'web-push';
import { deleteSub, type SubEntry } from './redis-store.js';
import { log } from './logger.js';
import type { BatchPlan } from './batch-executor.js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

const HIRO_EXPLORER = 'https://explorer.hiro.so';

// Gửi push cho tất cả wallet owners có plans trong batch vừa execute.
// allSubs: snapshot từ readAllSubs() đầu run — tránh gọi Redis thêm lần nữa.
export async function sendDcaExecutionNotifications(
  executedPlans: BatchPlan[],
  txid: string,
  allSubs: Record<string, SubEntry>,
): Promise<void> {
  if (executedPlans.length === 0) return;

  // Nhóm plan IDs để dễ build message: { walletAddr → planIds[] }
  const walletToPlans = new Map<string, BatchPlan[]>();

  for (const [addr, entry] of Object.entries(allSubs)) {
    if (!entry.planIds || entry.planIds.length === 0) continue;

    const matched = executedPlans.filter((p) => entry.planIds!.includes(p.planId));
    if (matched.length > 0) {
      walletToPlans.set(addr, matched);
    }
  }

  if (walletToPlans.size === 0) {
    log.info('dca-push: no subscribed wallets for this batch', { txid });
    return;
  }

  log.info('dca-push: sending execution notifications', {
    wallets: walletToPlans.size,
    txid,
  });

  for (const [addr, plans] of walletToPlans) {
    const entry = allSubs[addr];
    if (!entry?.subscription?.endpoint) continue;

    const planIds = plans.map((p) => p.planId);
    const planLabel = planIds.length === 1
      ? `Plan #${planIds[0]}`
      : `${planIds.length} plans (${planIds.map((id) => `#${id}`).join(', ')})`;

    const payload = JSON.stringify({
      title: 'StacksPort — DCA Executed ✓',
      body: `${planLabel} executed successfully. Tap to view details.`,
      txid,
      url: `${HIRO_EXPLORER}/txid/${txid}?chain=mainnet`,
      planIds,
    });

    try {
      await webpush.sendNotification(entry.subscription, payload);
      log.info('dca-push: sent', { addr, planIds, txid });
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 410 Gone / 404 = subscription expired; clean up Redis
      if (statusCode === 410 || statusCode === 404) {
        log.info('dca-push: subscription gone, removing', { addr });
        await deleteSub(addr).catch(() => {});
      } else {
        log.warn('dca-push: send failed', { addr, err: String(err) });
      }
    }
  }
}
