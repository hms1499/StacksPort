import webpush from 'web-push';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '../../data/push-subscriptions.json');

interface PushAlertEntry {
  id: string;
  tokenSymbol: string;
  geckoId: string;
  condition: 'above' | 'below';
  targetPrice: number;
  isActive: boolean;
  lastPushedAt: number | null;
}

interface PushSubscriptionEntry {
  subscription: { endpoint: string; keys: { auth: string; p256dh: string } };
  alerts: PushAlertEntry[];
  updatedAt: number;
}

type PushStore = Record<string, PushSubscriptionEntry>;

async function readStore(): Promise<PushStore> {
  try {
    return JSON.parse(await fs.readFile(DATA_PATH, 'utf-8')) as PushStore;
  } catch {
    return {};
  }
}

async function writeStore(store: PushStore): Promise<void> {
  const tmp = path.join(os.tmpdir(), `push-subs-${Date.now()}.json`);
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf-8');
  await fs.rename(tmp, DATA_PATH);
}

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const PUSH_COOLDOWN_MS = 60 * 60 * 1000;
const SUBSCRIPTION_TTL_MS = 8 * 60 * 60 * 1000; // 8 tiếng

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
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usd: number }>;
    return Object.fromEntries(Object.entries(data).map(([id, v]) => [id, v.usd]));
  } catch {
    return {};
  }
}

async function runOnce(): Promise<void> {
  const store = await readStore();

  const now = Date.now();
  let evicted = false;
  for (const addr of Object.keys(store)) {
    if (now - store[addr].updatedAt > SUBSCRIPTION_TTL_MS) {
      delete store[addr];
      evicted = true;
    }
  }
  if (evicted) await writeStore(store);

  const walletAddresses = Object.keys(store);
  if (walletAddresses.length === 0) return;

  const allGeckoIds = walletAddresses.flatMap((addr) =>
    store[addr].alerts.filter((a) => a.isActive).map((a) => a.geckoId)
  );

  const prices = await fetchPrices(allGeckoIds);
  if (Object.keys(prices).length === 0) return;

  let storeModified = false;

  for (const walletAddress of walletAddresses) {
    const entry = store[walletAddress];

    for (const alert of entry.alerts) {
      if (!alert.isActive) continue;

      const currentPrice = prices[alert.geckoId];
      if (currentPrice == null) continue;

      if (alert.lastPushedAt && Date.now() - alert.lastPushedAt < PUSH_COOLDOWN_MS) continue;

      const triggered =
        alert.condition === 'above' ? currentPrice >= alert.targetPrice : currentPrice <= alert.targetPrice;

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
        storeModified = true;
      } catch (err: unknown) {
        if ((err as { statusCode?: number }).statusCode === 410) {
          delete store[walletAddress];
          storeModified = true;
          break;
        }
      }
    }
  }

  if (storeModified) {
    await writeStore(store);
  }
}

export function startPricePushLoop(intervalMs = 10_000): void {
  const loop = async () => {
    try {
      await runOnce();
    } catch {
      // silent — loop continues regardless
    }
    setTimeout(loop, intervalMs);
  };
  loop();
}
