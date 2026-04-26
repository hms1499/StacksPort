// keeper-bot/src/price-push.ts
import webpush from 'web-push';
import {
  readAllSubs,
  writeSub,
  deleteSub,
  type SubEntry,
} from './redis-store.js';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const PUSH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between same-alert pushes

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

async function fetchPrices(geckoIds: string[]): Promise<Record<string, number>> {
  if (geckoIds.length === 0) return {};
  try {
    const ids = [...new Set(geckoIds)].join(',');
    const res = await fetch(`${COINGECKO_URL}?ids=${ids}&vs_currencies=usd`);
    if (!res.ok) {
      console.warn(JSON.stringify({ msg: 'coingecko non-ok', status: res.status }));
      return {};
    }
    const data = (await res.json()) as Record<string, { usd: number }>;
    return Object.fromEntries(Object.entries(data).map(([id, v]) => [id, v.usd]));
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'coingecko fetch failed', err: String(err) }));
    return {};
  }
}

async function processSub(addr: string, entry: SubEntry, prices: Record<string, number>): Promise<void> {
  let modified = false;

  for (const alert of entry.alerts) {
    if (!alert.isActive) continue;
    const currentPrice = prices[alert.geckoId];
    if (currentPrice == null) continue;
    if (alert.lastPushedAt && Date.now() - alert.lastPushedAt < PUSH_COOLDOWN_MS) continue;

    const triggered =
      alert.condition === 'above'
        ? currentPrice >= alert.targetPrice
        : currentPrice <= alert.targetPrice;
    if (!triggered) continue;

    const conditionLabel = alert.condition === 'above' ? 'vượt qua' : 'xuống dưới';
    const payload = JSON.stringify({
      title: 'StacksPort — Price Alert',
      body: `${alert.tokenSymbol} ${conditionLabel} $${alert.targetPrice.toLocaleString()} — giá hiện tại: $${currentPrice.toLocaleString()}`,
      alertId: alert.id,
      url: '/notifications',
    });

    try {
      await webpush.sendNotification(entry.subscription, payload);
      alert.lastPushedAt = Date.now();
      modified = true;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await deleteSub(addr);
        return; // sub gone, no more work for this addr
      }
      console.warn(JSON.stringify({ msg: 'push failed', addr, err: String(err) }));
    }
  }

  if (modified) {
    await writeSub(addr, entry);
  }
}

export async function runOnce(): Promise<void> {
  let subs: Record<string, SubEntry>;
  try {
    subs = await readAllSubs();
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'redis read failed', err: String(err) }));
    return;
  }

  const addresses = Object.keys(subs);
  if (addresses.length === 0) return;

  const allGeckoIds = addresses.flatMap((addr) =>
    subs[addr].alerts.filter((a) => a.isActive).map((a) => a.geckoId)
  );
  const prices = await fetchPrices(allGeckoIds);
  if (Object.keys(prices).length === 0) return;

  for (const addr of addresses) {
    try {
      await processSub(addr, subs[addr], prices);
    } catch (err) {
      console.warn(JSON.stringify({ msg: 'sub processing failed', addr, err: String(err) }));
    }
  }
}

export function startPricePushLoop(intervalMs: number): void {
  const loop = async () => {
    try {
      await runOnce();
    } catch (err) {
      console.error(JSON.stringify({ msg: 'tick fatal', err: String(err) }));
    }
    setTimeout(loop, intervalMs);
  };
  loop();
}
