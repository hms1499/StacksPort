# Price Push (Redis + Fly.io) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa price-push pipeline để hoạt động end-to-end production: thay file storage bằng Upstash Redis (Vercel Marketplace), deploy `push-worker` thành Fly.io machine `sin` region, relax cadence từ 10s → 15 phút để fit CoinGecko free tier.

**Architecture:** Browser ↔ Vercel functions (read/write Redis) ↔ Upstash Redis (`HASH push:subs`) ↔ Fly.io worker (15-min poll, send web push). In-app polling tự skip khi user đã grant push.

**Tech Stack:** Next.js 15, `@upstash/redis` (HTTP REST), `web-push`, Fly.io machines, Docker (Node 20 alpine).

**Spec:** `docs/superpowers/specs/2026-04-26-price-push-redis-fly-design.md`

---

## File Structure

**New (Vercel side):**
- `src/lib/push-redis.ts` — Upstash wrapper, replaces `push-storage.ts`
- `src/app/api/push/unregister/route.ts` — DELETE endpoint

**Modified (Vercel side):**
- `src/app/api/push/register/route.ts` — swap storage backend
- `src/hooks/usePushNotifications.ts` — add `unsubscribe()`
- `src/hooks/usePriceAlertPolling.ts` — coexistence skip
- `package.json` — add `@upstash/redis`

**Deleted (Vercel side):**
- `src/lib/push-storage.ts`

**New (Fly.io worker):**
- `keeper-bot/fly.toml`
- `keeper-bot/Dockerfile`
- `keeper-bot/.dockerignore`
- `keeper-bot/src/redis-store.ts`

**Modified (Fly.io worker):**
- `keeper-bot/src/push-worker.ts` — bootstrap loop with 15-min cadence
- `keeper-bot/src/price-push.ts` — Redis read instead of file
- `keeper-bot/package.json` — add `@upstash/redis`

**Unchanged:**
- `src/app/api/push/vapid-key/route.ts`
- `src/store/priceAlertStore.ts` (transparently switches backend)
- `src/components/price-alerts/PriceAlertForm.tsx`
- `public/sw.js` (verify only)
- DCA keeper (`keeper-bot/src/index.ts`), DCA execution watcher

---

### Task 0: Provision Upstash + Fly account (manual prerequisites)

User-blocking setup. Confirm before proceeding to code tasks. Implementer should pause here and ask user to confirm completion.

**Files:** none (manual ops)

- [ ] **Step 1: Install Upstash Redis via Vercel Marketplace**

In Vercel dashboard → Project StacksPort → Storage tab → click `Create Database` → choose `Upstash Redis` → free plan, region closest to `sin` (e.g., `ap-southeast-1` Singapore).

After install, Vercel auto-injects env vars into Production + Preview + Development. Modern Upstash integration uses these env var names (verify in Project Settings → Environment Variables):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If Vercel injected legacy `KV_REST_API_URL` / `KV_REST_API_TOKEN` instead, that's also fine — `@upstash/redis`'s `Redis.fromEnv()` reads either set. Note which set was injected for use in Task 2.

- [ ] **Step 2: Pull env to local**

```bash
cd /Users/vanhuy/Desktop/StacksPort
vercel env pull .env.local
```

Verify `.env.local` now contains `UPSTASH_REDIS_REST_URL` (or `KV_REST_API_URL`) and the token.

- [ ] **Step 3: Sign up Fly.io and install flyctl**

In a browser: https://fly.io/app/sign-up → free tier (no credit card required for free tier machines).

Install `flyctl`:
```bash
brew install flyctl
flyctl auth login
```

Verify:
```bash
flyctl auth whoami
```
Expected: prints your email.

- [ ] **Step 4: Confirm before continuing**

Pause. Ask user: "Upstash installed and `vercel env pull` done? Fly account active and `flyctl auth whoami` works?". If yes, proceed.

No commit (manual ops).

---

### Task 1: Add `@upstash/redis` to root package

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Install dependency**

```bash
cd /Users/vanhuy/Desktop/StacksPort
npm install @upstash/redis
```

- [ ] **Step 2: Verify install**

```bash
grep '"@upstash/redis"' package.json
```
Expected: shows the dep with a version, e.g. `"@upstash/redis": "^1.34.0"`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @upstash/redis to web app"
```

---

### Task 2: Create `src/lib/push-redis.ts`

**Files:**
- Create: `src/lib/push-redis.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/push-redis.ts
import { Redis } from '@upstash/redis';

const KEY = 'push:subs';

const redis = Redis.fromEnv();

export interface PushAlertEntry {
  id: string;
  tokenSymbol: string;
  geckoId: string;
  condition: 'above' | 'below';
  targetPrice: number;
  isActive: boolean;
  lastPushedAt: number | null;
}

export interface SubEntry {
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: PushAlertEntry[];
  updatedAt: number;
}

function normalizeAddr(addr: string): string {
  return addr.toLowerCase();
}

export async function getSub(addr: string): Promise<SubEntry | null> {
  const raw = await redis.hget<SubEntry | string>(KEY, normalizeAddr(addr));
  if (raw === null || raw === undefined) return null;
  // Upstash REST may return parsed object or stringified JSON depending on how it was written.
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as SubEntry; } catch { return null; }
  }
  return raw;
}

export async function putSub(addr: string, entry: SubEntry): Promise<void> {
  await redis.hset(KEY, { [normalizeAddr(addr)]: JSON.stringify(entry) });
}

export async function deleteSub(addr: string): Promise<void> {
  await redis.hdel(KEY, normalizeAddr(addr));
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p .
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/push-redis.ts
git commit -m "feat(push): add Upstash Redis storage wrapper"
```

---

### Task 3: Refactor `/api/push/register` to use Redis

**Files:**
- Modify: `src/app/api/push/register/route.ts`

- [ ] **Step 1: Replace file content**

```ts
// src/app/api/push/register/route.ts
import { NextResponse } from 'next/server';
import { putSub, type PushAlertEntry, type SubEntry } from '@/lib/push-redis';

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

  const entry: SubEntry = {
    subscription,
    alerts,
    updatedAt: Date.now(),
  };
  await putSub(walletAddress, entry);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p .
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/push/register/route.ts
git commit -m "refactor(push): switch register endpoint to Redis backend"
```

---

### Task 4: Add `/api/push/unregister`

**Files:**
- Create: `src/app/api/push/unregister/route.ts`

- [ ] **Step 1: Create the file**

```ts
// src/app/api/push/unregister/route.ts
import { NextResponse } from 'next/server';
import { deleteSub } from '@/lib/push-redis';

interface Body {
  walletAddress: string;
}

export async function POST(request: Request) {
  const { walletAddress } = (await request.json()) as Body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
  }
  await deleteSub(walletAddress);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p .
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/push/unregister/route.ts
git commit -m "feat(push): add unregister endpoint"
```

---

### Task 5: Add `unsubscribe()` to `usePushNotifications`

**Files:**
- Modify: `src/hooks/usePushNotifications.ts`

- [ ] **Step 1: Update import (PushAlertEntry now from `push-redis`)**

In `src/hooks/usePushNotifications.ts`, change line:
```ts
import type { PushAlertEntry } from '@/lib/push-storage';
```
to:
```ts
import type { PushAlertEntry } from '@/lib/push-redis';
```

- [ ] **Step 2: Add `unsubscribe` function and export**

Inside the `usePushNotifications()` hook body, ADD this function before `return`:

```ts
async function unsubscribe(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    if (walletAddress) {
      await fetch('/api/push/unregister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}
```

CHANGE the return statement at the end of the hook from:
```ts
return { permission, isSupported, subscribe };
```
to:
```ts
return { permission, isSupported, subscribe, unsubscribe };
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p .
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePushNotifications.ts
git commit -m "feat(push): add unsubscribe to usePushNotifications"
```

---

### Task 6: Update `priceAlertStore` import path

`priceAlertStore.ts` currently imports `PushAlertEntry` from the deleted `push-storage`.

**Files:**
- Modify: `src/store/priceAlertStore.ts`

- [ ] **Step 1: Change import**

In `src/store/priceAlertStore.ts`, change line:
```ts
import type { PushAlertEntry } from '@/lib/push-storage';
```
to:
```ts
import type { PushAlertEntry } from '@/lib/push-redis';
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit -p .
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/priceAlertStore.ts
git commit -m "refactor(push): update PushAlertEntry import path"
```

---

### Task 7: Delete legacy `src/lib/push-storage.ts`

All importers (Tasks 5, 6) now use `@/lib/push-redis`. Safe to delete.

**Files:**
- Delete: `src/lib/push-storage.ts`

- [ ] **Step 1: Confirm no remaining importers**

```bash
grep -rn "from '@/lib/push-storage'\|from \"@/lib/push-storage\"" src/ keeper-bot/ 2>/dev/null
```
Expected: no output. If anything still references it, fix that importer before deleting.

- [ ] **Step 2: Delete file**

```bash
rm src/lib/push-storage.ts
```

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit -p . && npm run lint
```
Expected: tsc clean. Lint may report pre-existing errors in other files — only blocking if a NEW error related to push-storage shows.

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/push-storage.ts
git commit -m "refactor(push): remove legacy file-based push storage"
```

---

### Task 8: Coexistence skip in `usePriceAlertPolling`

When user has granted push permission AND has an active subscription, in-app polling should short-circuit so we don't double-notify.

**Files:**
- Modify: `src/hooks/usePriceAlertPolling.ts`

- [ ] **Step 1: Add helper function**

In `src/hooks/usePriceAlertPolling.ts`, ADD this helper at module level (above the `usePriceAlertPolling` export):

```ts
async function hasActivePushSubscription(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) !== null;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Add early-return inside `check()`**

Inside the `check` async function in `usePriceAlertPolling`, ADD this as the FIRST line of the body:

```ts
if (await hasActivePushSubscription()) return;
```

The check function already begins with:
```ts
const check = async () => {
  const activeAlerts = alertsRef.current.filter((a) => a.isActive);
```

After change, it should look like:
```ts
const check = async () => {
  if (await hasActivePushSubscription()) return;
  const activeAlerts = alertsRef.current.filter((a) => a.isActive);
```

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit -p . && npm run lint
```
Expected: tsc clean. Lint pre-existing OK as long as no new errors in this file.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePriceAlertPolling.ts
git commit -m "feat(push): skip in-app polling when push subscription active"
```

---

### Task 9: Build and verify Vercel side

End of Vercel-side changes — verify it still builds before moving to worker.

**Files:** none (verification only)

- [ ] **Step 1: Production build**

```bash
npm run build
```
Expected: build succeeds. Some warnings are fine — must not error on missing imports / missing types.

- [ ] **Step 2: Lint**

```bash
npm run lint
```
Expected: no NEW errors related to changes (pre-existing errors in unrelated files OK). If lint reports a new error in any of the modified files, fix it before continuing.

No commit if no fixes needed.

---

### Task 10: Add `@upstash/redis` to keeper-bot

**Files:**
- Modify: `keeper-bot/package.json`

- [ ] **Step 1: Install**

```bash
cd /Users/vanhuy/Desktop/StacksPort/keeper-bot
npm install @upstash/redis
cd ..
```

- [ ] **Step 2: Verify**

```bash
grep '"@upstash/redis"' keeper-bot/package.json
```
Expected: shows the dep.

- [ ] **Step 3: Commit**

```bash
git add keeper-bot/package.json keeper-bot/package-lock.json
git commit -m "chore(keeper): add @upstash/redis to bot"
```

---

### Task 11: Create `keeper-bot/src/redis-store.ts`

Mirror of `src/lib/push-redis.ts` but for the keeper-bot CommonJS-friendly module shape (ESM with `.js` extensions per existing `tsconfig.json` `module: ES2020`).

**Files:**
- Create: `keeper-bot/src/redis-store.ts`

- [ ] **Step 1: Create the file**

```ts
// keeper-bot/src/redis-store.ts
import { Redis } from '@upstash/redis';

const KEY = 'push:subs';

const redis = Redis.fromEnv();

export interface PushAlertEntry {
  id: string;
  tokenSymbol: string;
  geckoId: string;
  condition: 'above' | 'below';
  targetPrice: number;
  isActive: boolean;
  lastPushedAt: number | null;
}

export interface SubEntry {
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: PushAlertEntry[];
  updatedAt: number;
}

function normalizeAddr(addr: string): string {
  return addr.toLowerCase();
}

export async function readAllSubs(): Promise<Record<string, SubEntry>> {
  const raw = await redis.hgetall<Record<string, SubEntry | string>>(KEY);
  if (!raw) return {};
  const out: Record<string, SubEntry> = {};
  for (const [addr, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      try { out[addr] = JSON.parse(v) as SubEntry; } catch { /* skip malformed */ }
    } else if (v && typeof v === 'object') {
      out[addr] = v as SubEntry;
    }
  }
  return out;
}

export async function writeSub(addr: string, entry: SubEntry): Promise<void> {
  await redis.hset(KEY, { [normalizeAddr(addr)]: JSON.stringify(entry) });
}

export async function deleteSub(addr: string): Promise<void> {
  await redis.hdel(KEY, normalizeAddr(addr));
}
```

- [ ] **Step 2: Type-check the keeper-bot project**

```bash
cd /Users/vanhuy/Desktop/StacksPort/keeper-bot
npx tsc --noEmit -p .
cd ..
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add keeper-bot/src/redis-store.ts
git commit -m "feat(keeper): add Redis store wrapper for push subs"
```

---

### Task 12: Rewrite `keeper-bot/src/price-push.ts`

Drop file-based store, drive from Redis. Core notify loop body migrates to a function `runOnce()` that reads all subs, fetches prices, sends pushes, evicts on 410.

**Files:**
- Modify: `keeper-bot/src/price-push.ts`

- [ ] **Step 1: Replace file content**

```ts
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
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/vanhuy/Desktop/StacksPort/keeper-bot
npx tsc --noEmit -p .
cd ..
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add keeper-bot/src/price-push.ts
git commit -m "refactor(keeper): drive price push from Redis instead of file"
```

---

### Task 13: Update `keeper-bot/src/push-worker.ts` cadence

**Files:**
- Modify: `keeper-bot/src/push-worker.ts`

- [ ] **Step 1: Replace file content**

```ts
// keeper-bot/src/push-worker.ts
import 'dotenv/config';
import { startPricePushLoop } from './price-push.js';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const INTERVAL_MS = parseInt(process.env.PUSH_CHECK_INTERVAL_MS ?? String(DEFAULT_INTERVAL_MS), 10);

console.log(JSON.stringify({
  msg: 'push-worker starting',
  intervalMs: INTERVAL_MS,
}));

startPricePushLoop(INTERVAL_MS);
```

- [ ] **Step 2: Type-check + build**

```bash
cd /Users/vanhuy/Desktop/StacksPort/keeper-bot
npx tsc --noEmit -p .
npm run build
cd ..
```
Expected: tsc clean, `dist/push-worker.js` produced.

- [ ] **Step 3: Local smoke (optional, only if you have valid Redis env locally)**

If `.env.local` already has Upstash creds and you want to test without deploying:
```bash
cd keeper-bot
npm run push   # uses ts-node loader against src/push-worker.ts
```
Expected: log `push-worker starting`, then either log "redis read failed" (if no Redis access from your network) or just sit idle if Redis empty. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add keeper-bot/src/push-worker.ts
git commit -m "feat(keeper): set push-worker cadence to 15 minutes"
```

---

### Task 14: Add Fly.io config files

**Files:**
- Create: `keeper-bot/fly.toml`
- Create: `keeper-bot/Dockerfile`
- Create: `keeper-bot/.dockerignore`

- [ ] **Step 1: Create `keeper-bot/fly.toml`**

```toml
app = "stacksport-push-worker"
primary_region = "sin"

[build]
  dockerfile = "Dockerfile"

[processes]
  worker = "node dist/push-worker.js"

[[vm]]
  size = "shared-cpu-1x"
  memory_mb = 256
  processes = ["worker"]
```

- [ ] **Step 2: Create `keeper-bot/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
CMD ["node", "dist/push-worker.js"]
```

- [ ] **Step 3: Create `keeper-bot/.dockerignore`**

```
node_modules
dist
.env
.env.*
*.log
.git
```

- [ ] **Step 4: Verify Docker build locally (optional but recommended)**

If you have Docker Desktop running:
```bash
cd keeper-bot
docker build -t stacksport-push-worker:test .
cd ..
```
Expected: build succeeds. If Docker not available locally, skip — Fly will build remotely on `flyctl deploy`.

- [ ] **Step 5: Commit**

```bash
git add keeper-bot/fly.toml keeper-bot/Dockerfile keeper-bot/.dockerignore
git commit -m "build(keeper): add Fly.io config and Dockerfile for push-worker"
```

---

### Task 15: Initialize Fly app and set secrets

**Files:** none (Fly.io configuration)

- [ ] **Step 1: Launch Fly app (no-deploy)**

```bash
cd /Users/vanhuy/Desktop/StacksPort/keeper-bot
flyctl launch --name stacksport-push-worker --region sin --no-deploy --copy-config --yes
```

If `flyctl launch` complains the app name is taken, pick another (e.g. `stacksport-push-worker-<yourhandle>`) and update `app = ...` in `fly.toml`.

Expected: `fly.toml` updated with the chosen name; no machines deployed yet.

- [ ] **Step 2: Set Fly secrets**

Read your local `.env.local` for the values. Run (replace `<...>` with real values):

```bash
flyctl secrets set \
  UPSTASH_REDIS_REST_URL='<value from .env.local>' \
  UPSTASH_REDIS_REST_TOKEN='<value from .env.local>' \
  VAPID_SUBJECT='<value from .env.local>' \
  VAPID_PUBLIC_KEY='<value from .env.local>' \
  VAPID_PRIVATE_KEY='<value from .env.local>'
```

Note: if Vercel injected legacy `KV_REST_API_URL` / `KV_REST_API_TOKEN` instead, set those names. `Redis.fromEnv()` reads either set, but use the SAME names you have locally for consistency.

- [ ] **Step 3: Verify secrets are set (names only — values are hidden)**

```bash
flyctl secrets list
```
Expected: 5 secrets listed (or 5 with the KV_* alternatives).

- [ ] **Step 4: Commit `fly.toml` if name was changed in Step 1**

```bash
git add keeper-bot/fly.toml
git commit -m "build(keeper): finalize Fly app name" --allow-empty
```

(Empty commit OK if nothing actually changed.)

---

### Task 16: Deploy to Fly and verify

**Files:** none (deploy operation)

- [ ] **Step 1: Deploy**

```bash
cd /Users/vanhuy/Desktop/StacksPort/keeper-bot
flyctl deploy
```
Expected: build succeeds, machine spawned in `sin`, status `started`.

- [ ] **Step 2: Tail logs**

```bash
flyctl logs
```
Expected: see `{"msg":"push-worker starting","intervalMs":900000}`. Within 15 minutes you should see the loop run (either no-op or `redis read failed` if creds wrong).

- [ ] **Step 3: Verify machine is running**

```bash
flyctl status
```
Expected: machine state `started`, image deployed, no crash loops.

- [ ] **Step 4: Sanity check Redis connection**

In Vercel project, view Upstash dashboard → Data Browser → confirm key `push:subs` exists or is empty. Worker should be hitting Redis on each tick (verify via Upstash command count over the next ~30 minutes).

- [ ] **Step 5: Commit (if any fly.toml changes)**

If `flyctl deploy` modified `fly.toml` (e.g. added a default env section), commit those:

```bash
git add keeper-bot/fly.toml
git diff --cached --quiet || git commit -m "build(keeper): apply Fly auto-config edits"
```

---

### Task 17: Production smoke test

End-to-end verification with a real wallet + real alert.

**Files:** none (verification)

- [ ] **Step 1: Push web app to main (Vercel auto-deploys)**

Up to here, all Vercel-side commits should already be on `main`. Confirm:
```bash
git log --oneline origin/main..HEAD || git log --oneline -10
git push origin main
```

Wait for Vercel to finish the production deploy (check Vercel dashboard).

- [ ] **Step 2: On the deployed app, test subscribe flow**

In a Chrome browser:
1. Open `https://<your-vercel-domain>/notifications` (or wherever PriceAlertForm is rendered — likely `/dashboard` or `/assets`)
2. Connect wallet
3. Create a price alert with target VERY close to current price (e.g. for BTC, target = current price ± $10) so it triggers next cycle
4. Click "Bật thông báo" when banner appears
5. Accept browser permission prompt

- [ ] **Step 3: Verify Redis has the sub**

Open Upstash dashboard → Data Browser → key `push:subs` → confirm one field with your wallet address (lowercase) and JSON value containing your subscription + the alert.

- [ ] **Step 4: Wait for trigger (≤15 minutes)**

When the next worker tick runs, you should:
- Receive native OS notification with title "StacksPort — Price Alert"
- See `lastPushedAt` updated in the Upstash entry

If notification doesn't arrive within 20 minutes:
- `flyctl logs` — look for "push failed" or other warnings
- Confirm `prices` was non-empty (not throttled) and `triggered` evaluated true given your threshold

- [ ] **Step 5: Verify in-app polling skip**

While the tab is open and push is granted, open DevTools → Application → Service Worker → confirm registration. Open Network tab → confirm NO calls to `/api/coingecko/simple/price` from the polling hook (push handles everything when subscribed).

- [ ] **Step 6: Commit smoke notes (if any fixes)**

If smoke test surfaced any small fix, commit it. Otherwise no commit.

---

### Task 18: Optional cleanup

**Files:**
- Delete: `data/push-subscriptions.json` (local-only legacy file)

- [ ] **Step 1: Remove the local file**

```bash
rm -f data/push-subscriptions.json
```

If `data/` becomes empty, you can remove the directory:
```bash
rmdir data 2>/dev/null || true
```

- [ ] **Step 2: Confirm not tracked / not needed**

```bash
git ls-files data/ | head
```
If empty: nothing tracked, safe to leave directory state as-is.

- [ ] **Step 3: Commit if anything changed**

```bash
git add -u data/ 2>/dev/null
git diff --cached --quiet || git commit -m "chore: remove legacy local push subscriptions file"
```

---

## Self-Review Checklist (post-write)

- ✅ **Spec coverage**:
  - Architecture diagram → Tasks 2-4 (Vercel), 11-13 (worker)
  - Storage schema → Task 2 (`SubEntry`, `KEY`, ops table)
  - Push worker config → Tasks 12-14 (fly.toml, Dockerfile, dockerignore)
  - Loop logic + cadence → Tasks 12-13
  - Coexistence rule → Task 8
  - Frontend changes (`unsubscribe`, polling skip) → Tasks 6, 8
  - `priceAlertStore.syncAlerts` unchanged but its import path needs updating → Task 7
  - Edge cases (410 evict, 429 throttle, race) → handled in Task 12 code
  - Deploy steps → Tasks 0, 9, 14, 15, 16, 17

- ✅ **Placeholder scan**: No "TBD", "TODO", "implement later". Every code block is complete. The only `<value from .env.local>` placeholders are explicit per-step values the operator pulls from their own env — that's correct (we can't know secrets ahead of time).

- ✅ **Type consistency**: `SubEntry`, `PushAlertEntry` defined in Task 2 (web) and Task 11 (keeper) with identical shape. `getSub`/`putSub`/`deleteSub` (web) vs `readAllSubs`/`writeSub`/`deleteSub` (keeper) — different names because access patterns differ (single-key vs full hash). Documented intentionally.

- ✅ **DRY/YAGNI**: Two parallel `redis-store.ts` modules (web and keeper) each have ONE responsibility. No shared package extracted — would force a monorepo restructure for trivial code reuse.

- ✅ **TDD**: Skipped — repo has no unit-test framework. Task 9 + Task 17 are the verification gates.

- ✅ **Frequent commits**: 14 functional commits across 18 tasks (Task 0 manual, Task 9/15/17/18 conditional). User's commit-cadence preference (`feedback_commit_cadence.md`) honored: each commit at a meaningful checkpoint.
