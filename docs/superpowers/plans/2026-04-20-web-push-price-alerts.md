# Web Push Price Alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver native push notifications for price alerts that fire within ~10 seconds, even when the browser tab is closed or the app is in the background on mobile.

**Architecture:** Keeper bot gains a separate `push-worker.ts` daemon that polls CoinGecko every 10s, reads alert subscriptions from `data/push-subscriptions.json`, and sends Web Push via the `web-push` library. Next.js exposes two lightweight API routes (VAPID key + register). The browser registers a Service Worker, subscribes to push, and syncs alert config to the server via `priceAlertStore`.

**Tech Stack:** Web Push API, VAPID, `web-push` npm package, Next.js App Router API routes, Zustand, atomic file writes (tmp + rename), Node.js ESM

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `keeper-bot/src/price-push.ts` | Create | Core price-check-and-push loop |
| `keeper-bot/src/push-worker.ts` | Create | Daemon entry point, runs loop forever |
| `public/sw.js` | Create | Service Worker — receives push, shows notification, handles click |
| `src/hooks/usePushNotifications.ts` | Create | Subscribe/unsubscribe, expose permission state |
| `src/lib/push-storage.ts` | Create | Atomic read/write for push-subscriptions.json |
| `src/app/api/push/vapid-key/route.ts` | Create | Serve VAPID public key |
| `src/app/api/push/register/route.ts` | Create | Upsert subscription + alerts to JSON |
| `data/push-subscriptions.json` | Create | Storage file (empty `{}`) |
| `src/store/priceAlertStore.ts` | Modify | Sync alerts to server after every mutation |
| `src/components/price-alerts/PriceAlertForm.tsx` | Modify | Show permission banner after first alert created |
| `src/app/layout-client.tsx` | Modify | Register Service Worker on mount |
| `keeper-bot/package.json` | Modify | Add `web-push` dep + `push` script |
| `keeper-bot/.env` | Modify | Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT |
| `.env.local` | Modify | Add VAPID_PUBLIC_KEY (for Next.js) |

---

## Task 1: Install web-push + generate VAPID keys

**Files:**
- Modify: `keeper-bot/package.json`
- Modify: `keeper-bot/.env`
- Modify: `.env.local`

- [ ] **Step 1: Install web-push in keeper-bot**

```bash
cd keeper-bot && npm install web-push && npm install --save-dev @types/web-push
```

Expected: `web-push` added to `keeper-bot/package.json` dependencies.

- [ ] **Step 2: Generate VAPID key pair**

```bash
cd keeper-bot && node -e "
const webpush = await import('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
"
```

Copy the output. You'll use these values in the next steps. Keep them safe — regenerating breaks existing subscriptions.

- [ ] **Step 3: Add VAPID vars to keeper-bot/.env**

Add these lines (replace with your generated values):

```bash
VAPID_PUBLIC_KEY=BExamplePublicKeyBase64UrlEncoded...
VAPID_PRIVATE_KEY=ExamplePrivateKeyBase64UrlEncoded...
VAPID_SUBJECT=mailto:thanvanhuyy@gmail.com
```

- [ ] **Step 4: Add VAPID_PUBLIC_KEY to .env.local**

Add this line (same public key, Next.js needs it to tell the browser which key to subscribe with):

```bash
VAPID_PUBLIC_KEY=BExamplePublicKeyBase64UrlEncoded...
```

- [ ] **Step 5: Commit**

```bash
cd .. && git add keeper-bot/package.json keeper-bot/package-lock.json
git commit -m "chore(push): install web-push in keeper-bot"
```

---

## Task 2: Create data directory and storage file

**Files:**
- Create: `data/push-subscriptions.json`
- Create: `src/lib/push-storage.ts`

- [ ] **Step 1: Create data directory and empty JSON file**

```bash
mkdir -p data && echo '{}' > data/push-subscriptions.json
```

- [ ] **Step 2: Add data/ to .gitignore**

Open `.gitignore` and add:

```
data/push-subscriptions.json
```

(This file contains push subscription endpoints — don't commit.)

- [ ] **Step 3: Create atomic read/write helper**

Create `src/lib/push-storage.ts`:

```typescript
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
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add data/.gitkeep src/lib/push-storage.ts .gitignore
git commit -m "feat(push): add push-storage helper and data dir"
```

---

## Task 3: Next.js API routes

**Files:**
- Create: `src/app/api/push/vapid-key/route.ts`
- Create: `src/app/api/push/register/route.ts`

- [ ] **Step 1: Create VAPID key route**

Create `src/app/api/push/vapid-key/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 });
  }
  return NextResponse.json({ publicKey });
}
```

- [ ] **Step 2: Create register route**

Create `src/app/api/push/register/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { readPushStore, writePushStore, type PushAlertEntry } from '@/lib/push-storage';

interface RegisterBody {
  walletAddress: string;
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: PushAlertEntry[];
}

export async function POST(request: Request) {
  const body = await request.json() as RegisterBody;
  const { walletAddress, subscription, alerts } = body;

  if (!walletAddress || !subscription?.endpoint) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const store = await readPushStore();
  store[walletAddress] = { subscription, alerts, updatedAt: Date.now() };
  await writePushStore(store);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify routes compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and manually test vapid-key route**

```bash
npm run dev
```

In another terminal:
```bash
curl http://localhost:3000/api/push/vapid-key
```

Expected: `{"publicKey":"BExample..."}` (your VAPID public key).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/push/
git commit -m "feat(push): add vapid-key and register API routes"
```

---

## Task 4: Service Worker

**Files:**
- Create: `public/sw.js`
- Modify: `src/app/layout-client.tsx`

- [ ] **Step 1: Create Service Worker**

Create `public/sw.js`:

```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title ?? 'StacksPort — Price Alert';
  const options = {
    body: data.body ?? '',
    icon: '/icon.jpg',
    badge: '/icon.jpg',
    tag: data.alertId ?? 'price-alert',
    data: { url: data.url ?? '/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
```

- [ ] **Step 2: Register Service Worker in layout-client.tsx**

Open `src/app/layout-client.tsx` and add this `useEffect` inside `LayoutClient` (before the return):

```typescript
import { useEffect } from 'react';
```

Add inside `LayoutClient`, before `return`:

```typescript
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
```

- [ ] **Step 3: Verify Service Worker registers in browser**

Start dev server: `npm run dev`

Open http://localhost:3000, open DevTools → Application → Service Workers.
Expected: `sw.js` shows as "activated and is running".

- [ ] **Step 4: Commit**

```bash
git add public/sw.js src/app/layout-client.tsx
git commit -m "feat(push): add service worker and register in layout"
```

---

## Task 5: `usePushNotifications` hook

**Files:**
- Create: `src/hooks/usePushNotifications.ts`

- [ ] **Step 1: Create hook**

Create `src/hooks/usePushNotifications.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { usePriceAlertStore } from '@/store/priceAlertStore';
import type { PushAlertEntry } from '@/lib/push-storage';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushPermission = 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const walletAddress = useWalletStore((s) => s.address);
  const alerts = usePriceAlertStore((s) => s.alerts);

  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission as PushPermission);
    }
  }, []);

  async function subscribe(): Promise<boolean> {
    if (!isSupported || !walletAddress) return false;

    const perm = await Notification.requestPermission();
    setPermission(perm as PushPermission);
    if (perm !== 'granted') return false;

    try {
      const keyRes = await fetch('/api/push/vapid-key');
      const { publicKey } = await keyRes.json() as { publicKey: string };

      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = pushSub.toJSON() as {
        endpoint: string;
        keys: { auth: string; p256dh: string };
      };

      const pushAlerts: PushAlertEntry[] = alerts
        .filter((a) => a.isActive)
        .map((a) => ({
          id: a.id,
          tokenSymbol: a.tokenSymbol,
          geckoId: a.geckoId,
          condition: a.condition,
          targetPrice: a.targetPrice,
          isActive: a.isActive,
          lastPushedAt: null,
        }));

      await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, subscription: subJson, alerts: pushAlerts }),
      });

      return true;
    } catch {
      return false;
    }
  }

  return { permission, isSupported, subscribe };
}
```

- [ ] **Step 2: Check walletStore exposes `address`**

```bash
grep -n "address" src/store/walletStore.ts | head -10
```

Expected: `address` field exists in the store. If the field has a different name (e.g. `stxAddress`), update the selector in the hook accordingly.

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePushNotifications.ts
git commit -m "feat(push): add usePushNotifications hook"
```

---

## Task 6: Update `priceAlertStore` to sync alerts to server

**Files:**
- Modify: `src/store/priceAlertStore.ts`

- [ ] **Step 1: Add syncToServer helper inside the store**

Open `src/store/priceAlertStore.ts`. Replace the entire file with:

```typescript
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PriceAlert, PriceAlertCondition, PriceAlertStoreState } from '@/types/priceAlerts';
import type { PushAlertEntry } from '@/lib/push-storage';

const generateId = () => `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

async function syncAlerts(walletAddress: string, alerts: PriceAlert[]) {
  if (!walletAddress || Notification.permission !== 'granted') return;

  let sub: PushSubscription | null = null;
  try {
    const reg = await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
  } catch {
    return;
  }
  if (!sub) return;

  const subJson = sub.toJSON() as { endpoint: string; keys: { auth: string; p256dh: string } };
  const pushAlerts: PushAlertEntry[] = alerts
    .filter((a) => a.isActive)
    .map((a) => ({
      id: a.id,
      tokenSymbol: a.tokenSymbol,
      geckoId: a.geckoId,
      condition: a.condition,
      targetPrice: a.targetPrice,
      isActive: a.isActive,
      lastPushedAt: null,
    }));

  await fetch('/api/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, subscription: subJson, alerts: pushAlerts }),
  }).catch(() => {});
}

export const usePriceAlertStore = create<PriceAlertStoreState>()(
  persist(
    (set, get) => ({
      alerts: [],
      walletAddress: '',

      setWalletAddress: (addr: string) => set({ walletAddress: addr }),

      addAlert: (
        tokenSymbol: string,
        geckoId: string,
        condition: PriceAlertCondition,
        targetPrice: number
      ) => {
        const alert: PriceAlert = {
          id: generateId(),
          tokenSymbol,
          geckoId,
          condition,
          targetPrice,
          isActive: true,
          createdAt: Date.now(),
        };
        set((state) => ({ alerts: [alert, ...state.alerts] }));
        syncAlerts(get().walletAddress, get().alerts);
      },

      removeAlert: (id: string) => {
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }));
        syncAlerts(get().walletAddress, get().alerts);
      },

      toggleAlert: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: !a.isActive } : a
          ),
        }));
        syncAlerts(get().walletAddress, get().alerts);
      },

      markTriggered: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: false, triggeredAt: Date.now() } : a
          ),
        }));
        syncAlerts(get().walletAddress, get().alerts);
      },

      resetAlert: (id: string) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, isActive: true, triggeredAt: undefined } : a
          ),
        }));
        syncAlerts(get().walletAddress, get().alerts);
      },
    }),
    { name: 'price-alerts-storage' }
  )
);
```

- [ ] **Step 2: Update `PriceAlertStoreState` type to include new fields**

Open `src/types/priceAlerts.ts`. Add `walletAddress` and `setWalletAddress` to the interface:

```typescript
export interface PriceAlertStoreState {
  alerts: PriceAlert[];
  walletAddress: string;
  setWalletAddress: (addr: string) => void;
  addAlert: (
    tokenSymbol: string,
    geckoId: string,
    condition: PriceAlertCondition,
    targetPrice: number
  ) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  markTriggered: (id: string) => void;
  resetAlert: (id: string) => void;
}
```

- [ ] **Step 3: Wire wallet address into priceAlertStore**

Find where the app sets the connected wallet address (likely in a wallet connection hook or `walletStore`). Search:

```bash
grep -rn "setWalletAddress\|walletStore\|address" src/store/walletStore.ts | head -20
```

In `src/app/layout-client.tsx`, add a component that syncs the wallet address to `priceAlertStore`:

```typescript
import { usePriceAlertStore } from '@/store/priceAlertStore';
import { useWalletStore } from '@/store/walletStore';

function WalletAddressSync() {
  const address = useWalletStore((s) => s.address); // adjust field name if different
  const setWalletAddress = usePriceAlertStore((s) => s.setWalletAddress);
  useEffect(() => { setWalletAddress(address ?? ''); }, [address, setWalletAddress]);
  return null;
}
```

Add `<WalletAddressSync />` inside the `ThemeProvider` in `layout-client.tsx`.

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/store/priceAlertStore.ts src/types/priceAlerts.ts src/app/layout-client.tsx
git commit -m "feat(push): sync price alerts to server after mutations"
```

---

## Task 7: Permission banner in `PriceAlertForm`

**Files:**
- Modify: `src/components/price-alerts/PriceAlertForm.tsx`

- [ ] **Step 1: Add push permission banner after form submit**

Open `src/components/price-alerts/PriceAlertForm.tsx`. Make the following changes:

Add import at top:
```typescript
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell } from 'lucide-react';
```

Add inside `PriceAlertForm` component:
```typescript
const { permission, isSupported, subscribe } = usePushNotifications();
const [justCreated, setJustCreated] = useState(false);
const [subscribing, setSubscribing] = useState(false);
```

Update `handleSubmit` to set `justCreated`:
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const price = parseFloat(targetPrice);
  if (!targetPrice || isNaN(price) || price <= 0) {
    setError('Please enter a valid price greater than 0');
    return;
  }
  setError('');
  addAlert(selectedToken.symbol, selectedToken.geckoId, condition, price);
  setTargetPrice('');
  setJustCreated(true);
};

const handleEnablePush = async () => {
  setSubscribing(true);
  await subscribe();
  setSubscribing(false);
  setJustCreated(false);
};
```

Add this banner just before the closing `</form>` tag:
```tsx
{justCreated && isSupported && permission !== 'granted' && (
  <div className="flex items-center gap-3 mt-3 p-3 bg-[#B0E4CC]/20 border border-[#408A71]/30 rounded-xl">
    <Bell size={16} className="text-[#408A71] shrink-0" />
    <span className="text-xs text-gray-600 flex-1">
      Nhận alert ngay cả khi đóng app?
    </span>
    <button
      type="button"
      onClick={handleEnablePush}
      disabled={subscribing}
      className="text-xs font-medium text-[#408A71] hover:text-[#285A48] disabled:opacity-50"
    >
      {subscribing ? 'Đang bật...' : 'Bật thông báo'}
    </button>
    <button
      type="button"
      onClick={() => setJustCreated(false)}
      className="text-xs text-gray-400 hover:text-gray-600"
    >
      Bỏ qua
    </button>
  </div>
)}
```

- [ ] **Step 2: Verify in browser**

Start dev server. Navigate to the Price Alerts page. Create a new alert. Verify:
- Banner appears below the form with "Nhận alert ngay cả khi đóng app?"
- Clicking "Bật thông báo" triggers the browser permission dialog
- After granting, banner disappears

- [ ] **Step 3: Commit**

```bash
git add src/components/price-alerts/PriceAlertForm.tsx
git commit -m "feat(push): add permission banner to PriceAlertForm"
```

---

## Task 8: Keeper bot — `price-push.ts`

**Files:**
- Create: `keeper-bot/src/price-push.ts`

- [ ] **Step 1: Create price-push module**

Create `keeper-bot/src/price-push.ts`:

```typescript
import webpush from 'web-push';
import { readPushStore, writePushStore } from '../../src/lib/push-storage.js';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';
const PUSH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between pushes for the same alert

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
  const store = await readPushStore();
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

      // Cooldown check
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
        // 410 Gone = subscription expired, remove it
        if ((err as { statusCode?: number }).statusCode === 410) {
          delete store[walletAddress];
          storeModified = true;
          break;
        }
      }
    }
  }

  if (storeModified) {
    await writePushStore(store);
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
```

- [ ] **Step 2: Resolve import path issue**

The keeper-bot is a separate package. It cannot import from `../../src/lib/push-storage.js` (Next.js source). Copy the shared types inline instead:

Replace the import at the top with a self-contained version:

```typescript
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
```

Remove the `readPushStore`/`writePushStore` import and replace their calls with `readStore()`/`writeStore()`.

- [ ] **Step 3: Verify keeper-bot TypeScript compiles**

```bash
cd keeper-bot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add keeper-bot/src/price-push.ts
git commit -m "feat(push): add price-push loop to keeper-bot"
```

---

## Task 9: Keeper bot — push-worker daemon

**Files:**
- Create: `keeper-bot/src/push-worker.ts`
- Modify: `keeper-bot/package.json`

- [ ] **Step 1: Create push-worker entry point**

Create `keeper-bot/src/push-worker.ts`:

```typescript
import 'dotenv/config';
import { startPricePushLoop } from './price-push.js';

const INTERVAL_MS = parseInt(process.env.PUSH_CHECK_INTERVAL_MS ?? '10000', 10);

console.log(`[push-worker] Starting price push loop (interval: ${INTERVAL_MS}ms)`);
startPricePushLoop(INTERVAL_MS);
```

- [ ] **Step 2: Add `push` script to keeper-bot/package.json**

Open `keeper-bot/package.json`. Add to `scripts`:

```json
"push": "ts-node src/push-worker.ts",
"push:prod": "node dist/push-worker.js"
```

- [ ] **Step 3: Build and verify**

```bash
cd keeper-bot && npm run build
```

Expected: `dist/push-worker.js` exists, no TypeScript errors.

- [ ] **Step 4: Test push-worker runs without crashing**

Make sure `keeper-bot/.env` has VAPID vars set, then:

```bash
cd keeper-bot && npm run push
```

Expected: prints `[push-worker] Starting price push loop (interval: 10000ms)` and keeps running. If `data/push-subscriptions.json` is empty `{}`, it loops silently every 10s.

Press Ctrl+C to stop.

- [ ] **Step 5: Commit**

```bash
git add keeper-bot/src/push-worker.ts keeper-bot/package.json
git commit -m "feat(push): add push-worker daemon entry point"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Start Next.js dev server**

```bash
npm run dev
```

- [ ] **Step 2: Connect a wallet and create a price alert**

Navigate to the notifications/price-alerts page. Connect your Leather or Xverse wallet. Create an alert (e.g. BTC above $1 — to guarantee it fires immediately).

- [ ] **Step 3: Enable push notifications**

Click "Bật thông báo" in the banner. Grant browser permission.

Verify in DevTools → Application → Service Workers: `sw.js` is active.

Verify `data/push-subscriptions.json` now contains your wallet address + subscription + alert.

- [ ] **Step 4: Start push-worker**

In a new terminal:

```bash
cd keeper-bot && npm run push
```

Watch the console. Within 10 seconds, the worker should detect the alert is triggered and send a push.

- [ ] **Step 5: Verify native notification appears**

Expected: a native OS notification appears with title "StacksPort — Price Alert" and the correct message. Click it — browser should open/focus `/notifications`.

- [ ] **Step 6: Verify cooldown works**

Wait 10 more seconds. The same alert should NOT fire again (cooldown = 60 minutes).

- [ ] **Step 7: Final commit if any cleanup needed**

```bash
git add -A && git commit -m "feat(push): web push price alerts complete"
```
