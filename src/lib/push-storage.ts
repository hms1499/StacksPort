import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DATA_PATH = path.join(process.cwd(), 'data', 'push-subscriptions.json');

export interface PushAlertEntry {
  id: string;
  tokenSymbol: string;
  geckoId: string;
  condition: 'above' | 'below';
  targetPrice: number;
  isActive: boolean;
  lastPushedAt: number | null;
}

export interface PushSubscriptionEntry {
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: PushAlertEntry[];
  updatedAt: number;
}

export type PushStore = Record<string, PushSubscriptionEntry>;

export async function readPushStore(): Promise<PushStore> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw) as PushStore;
  } catch {
    return {};
  }
}

export async function writePushStore(store: PushStore): Promise<void> {
  const tmp = path.join(os.tmpdir(), `push-subs-${Date.now()}.json`);
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf-8');
  await fs.rename(tmp, DATA_PATH);
}
