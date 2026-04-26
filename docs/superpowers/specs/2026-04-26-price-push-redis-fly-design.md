# Price Push via Redis + Fly.io — Design Spec

**Date:** 2026-04-26
**Status:** Approved

## Overview

Sửa pipeline price-alert web push để hoạt động trong production. Hiện tại UI "Bật thông báo" hứa "nhận alert ngay cả khi đóng app" nhưng pipeline đứt:

- `/api/push/register` ghi vào `data/push-subscriptions.json` qua filesystem — Vercel Fluid Compute không persist được
- `keeper-bot/src/push-worker.ts` không deploy ở đâu (không có trong workflow GitHub Actions hay `render.yaml`)

Fix: thay file storage bằng **Upstash Redis** (Vercel Marketplace), deploy push-worker thành **Fly.io machine** ở region `sin`. Cả hai dùng free tier. Polling cadence relax từ 10s → 15 phút để fit CoinGecko Demo free (10K req/tháng).

## Goals

- Price alerts trigger native OS notification ngay cả khi tab đóng / browser closed
- Production hoạt động end-to-end: subscribe → store persistent → worker poll → push deliver
- Không phá in-app polling: user không grant push vẫn nhận noti khi app open
- Free tier toàn bộ stack (Vercel Hobby + Upstash free + Fly free + CoinGecko Demo)

## Non-goals

- **Multi-device push per wallet** — overwrite sub khi device thứ 2 register
- **Sharded `push:subs`** — single hash ok đến ~5K users
- **Push for DCA execution** — feature riêng (đã build in-app version, push là follow-up)
- **Trigger latency <15 phút** — đòi CoinGecko paid; user paying có thể upgrade sau
- **Migration data từ `data/push-subscriptions.json`** — local-only file, drop fresh start

## Architecture

```
Browser (Next.js)              Vercel Functions               Fly.io machine (push-worker)
─────────────────              ────────────────               ────────────────────────────
priceAlertStore                /api/push/register             every 15 min:
usePushNotifications  ─POST→   /api/push/unregister (NEW)      1. HGETALL push:subs
  (subscribe/unsub)            /api/push/vapid-key             2. Fetch CoinGecko prices
usePriceAlertPolling                │                          3. For each sub:
  (skip if pushSub exists)          ▼                            check alerts → triggered →
                               Upstash Redis ◄────────────       webpush.send + HSET
                               HASH push:subs                    update lastPushedAt
                                  field=walletAddress         4. On 410 Gone: HDEL
                                  value=JSON{sub,alerts}
```

**Coexistence rule**: `usePriceAlertPolling` short-circuits khi `Notification.permission === 'granted' && pushSubscription !== null`. Push handle hết — kể cả tab đang open browser sẽ hiện native OS noti, không in-app toast.

## Storage

**Library**: `@upstash/redis` HTTP REST client. Env vars từ Vercel Marketplace (`KV_REST_API_URL`, `KV_REST_API_TOKEN`).

**Schema**: 1 hash key `push:subs`.

```ts
// HASH push:subs
//   field: walletAddress (lowercased)
//   value: JSON.stringify(SubEntry)

interface SubEntry {
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
  alerts: Array<{
    id: string;
    tokenSymbol: string;
    geckoId: string;
    condition: 'above' | 'below';
    targetPrice: number;
    isActive: boolean;
    lastPushedAt: number | null;
  }>;
  updatedAt: number; // ms
}
```

**Operations**:

| Op | Caller | Redis command |
|---|---|---|
| Upsert sub + alerts | Vercel `/api/push/register` | `HSET push:subs <addr> <json>` |
| Delete sub | Vercel `/api/push/unregister` | `HDEL push:subs <addr>` |
| Read all subs | Fly worker per tick | `HGETALL push:subs` |
| Update sub after send | Fly worker | `HSET push:subs <addr> <json>` |
| Evict on 410 Gone | Fly worker | `HDEL push:subs <addr>` |

**Free tier fit**: 15 phút polling × 24h × 30 ngày = 2880 cycles/tháng × ~3 cmd/cycle (HGETALL + occasional HSET/HDEL) ≈ <30K cmd/tháng. Free tier 500K cmd → comfortable >10x headroom.

**Storage size**: ~500 bytes/sub × 5K users = 2.5MB. Free tier 256MB → comfortable.

**Subscription TTL**: dropped. Dead subs evict via 410 Gone signal from push service. No time-based eviction.

## Push Worker (Fly.io)

**Region**: `sin` (Singapore — closest to Vietnam).

**Machine size**: `shared-cpu-1x@256mb` × 1 instance, always-on. Within Fly free tier.

**File layout** (in `keeper-bot/`):

```
keeper-bot/
├── fly.toml                    NEW
├── Dockerfile                  NEW
├── src/
│   ├── push-worker.ts          REWRITE (Redis read instead of file)
│   ├── price-push.ts           REWRITE (drop file I/O)
│   ├── redis-store.ts          NEW (thin wrapper around @upstash/redis)
│   └── index.ts                UNCHANGED (DCA keeper)
├── package.json                ADD @upstash/redis dep, update scripts
└── tsconfig.json               UNCHANGED
```

**`fly.toml`**:
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

No `[[services]]` block — worker không expose HTTP port. No health endpoint cần.

**`Dockerfile`** (multi-stage):
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

**Loop logic** (15-min cadence):
```
const INTERVAL_MS = 15 * 60 * 1000;

async function tick() {
  let subs;
  try {
    subs = await redis.hgetall<Record<string, string>>('push:subs');
  } catch (err) {
    log warn 'redis read failed', return;
  }
  if (!subs || Object.keys(subs).length === 0) return;

  const allGeckoIds = unique active alert geckoIds across all subs
  const prices = await fetchPrices(allGeckoIds);
  if (Object.keys(prices).length === 0) return; // CoinGecko throttled

  for ([addr, json] of Object.entries(subs)) {
    const entry: SubEntry = typeof json === 'string' ? JSON.parse(json) : json;
    let modified = false;
    let evicted = false;

    for (alert of entry.alerts) {
      if (!alert.isActive) continue;
      const currentPrice = prices[alert.geckoId];
      if (currentPrice == null) continue;
      if (alert.lastPushedAt && Date.now() - alert.lastPushedAt < PUSH_COOLDOWN_MS) continue;

      const triggered = alert.condition === 'above'
        ? currentPrice >= alert.targetPrice
        : currentPrice <= alert.targetPrice;
      if (!triggered) continue;

      try {
        await webpush.sendNotification(entry.subscription, JSON.stringify({
          title: 'StacksPort — Price Alert',
          body: `${alert.tokenSymbol} ${alert.condition === 'above' ? 'vượt' : 'xuống dưới'} $${alert.targetPrice} — hiện tại $${currentPrice}`,
          alertId: alert.id,
          url: '/notifications',
        }));
        alert.lastPushedAt = Date.now();
        modified = true;
      } catch (err) {
        if (err.statusCode === 410) {
          await redis.hdel('push:subs', addr);
          evicted = true;
          break;
        }
        log warn `push failed for ${addr}`;
      }
    }

    if (modified && !evicted) {
      await redis.hset('push:subs', { [addr]: JSON.stringify(entry) });
    }
  }
}

async function loop() {
  try { await tick(); } catch (err) { log error; }
  setTimeout(loop, INTERVAL_MS);
}

loop();
```

**Constants**:
- `PUSH_COOLDOWN_MS = 60 * 60 * 1000` (1 hour between same-alert pushes)
- `INTERVAL_MS = 15 * 60 * 1000` (15 minutes polling)

**Secrets** (set via `flyctl secrets set`):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `VAPID_SUBJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

**Failure modes**:
- Fly machine crash → Fly auto-restart per default policy
- CoinGecko 429 → return empty prices, skip cycle, retry next tick
- Redis transient failure → log warn, skip cycle, retry next tick
- webpush 410 Gone → HDEL evict
- webpush other errors → log, sub stays, retry next cycle

**Observability**: `flyctl logs -a stacksport-push-worker` for realtime. Use structured `console.log({...})` for searchable lines.

## Vercel-side Changes

**`src/lib/push-redis.ts`** (NEW, replaces `push-storage.ts`):
```ts
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const KEY = 'push:subs';

export interface SubEntry { /* same shape as worker */ }

export async function getSub(addr: string): Promise<SubEntry | null>
export async function putSub(addr: string, entry: SubEntry): Promise<void>
export async function deleteSub(addr: string): Promise<void>
```

**`src/lib/push-storage.ts`**: DELETED.

**`src/app/api/push/register/route.ts`**: swap `readPushStore`/`writePushStore` → `putSub`. Logic identical.

**`src/app/api/push/unregister/route.ts`** (NEW):
```ts
import { NextResponse } from 'next/server';
import { deleteSub } from '@/lib/push-redis';

interface Body { walletAddress: string }

export async function POST(request: Request) {
  const { walletAddress } = (await request.json()) as Body;
  if (!walletAddress) {
    return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
  }
  await deleteSub(walletAddress);
  return NextResponse.json({ ok: true });
}
```

**`src/app/api/push/vapid-key/route.ts`**: UNCHANGED.

**Env vars** (Vercel project, auto từ Marketplace):
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- (existing) `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

**`@upstash/redis` package**: add to root `package.json` dep.

## Frontend Changes

**`src/store/priceAlertStore.ts`**: `syncAlerts` UNCHANGED — vẫn POST `/api/push/register`. Backend swap is transparent.

**`src/hooks/usePushNotifications.ts`**: ADD `unsubscribe()`:
```ts
async function unsubscribe(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    if (walletAddress) {
      await fetch('/api/push/unregister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
    }
    return true;
  } catch {
    return false;
  }
}

return { permission, isSupported, subscribe, unsubscribe };
```

**`src/hooks/usePriceAlertPolling.ts`** — coexistence rule:
```ts
async function checkPushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) !== null;
  } catch {
    return false;
  }
}

// Inside check() — first line:
if (await checkPushSubscription()) return;
// rest of existing polling logic
```

**`src/components/price-alerts/PriceAlertForm.tsx`**: UNCHANGED. UI "Bật thông báo" giữ nguyên — backend đã fix nên hoạt động đúng end-to-end.

**Service worker (`public/sw.js`)**: verify đã handle `push` event hiện ra native OS notification. Nếu chưa, thêm trong implementation.

## Edge Cases

| Case | Behavior |
|---|---|
| User grant push, sau đó revoke browser permission | Sub vẫn ở Redis. Worker push → 410 Gone → HDEL evict. Polling resume vì `permission !== 'granted'`. |
| User clear site data | Local sub mất. Backend Redis vẫn có sub cũ → push gửi tới sub đã chết → 410 → evict. |
| User chuyển wallet giữa chừng | `priceAlertStore` listen `walletAddress` change → register sub mới với address mới. Address cũ giữ sub cũ ở Redis cho tới khi browser unsubscribe → 410 → evict. |
| 2 device cùng wallet | Device thứ 2 register overwrite sub device 1. Push chỉ tới device cuối register. Acceptable. |
| CoinGecko 429 | Empty prices → skip cycle → retry 15p sau. Log warn. |
| Fly OOM | Auto-restart. Tối đa 1 cycle loss. |
| Race: user mutate alerts đúng lúc worker process | Worker đọc state at HGETALL time, user mutation HSET sau, worker HSET update lastPushedAt overwrite mutation. Hậu quả tối đa: 1 alert disabled fire 1 lần. YAGNI optimistic locking. |
| User uninstalls extension/app | Browser unsubscribes → endpoint 410 → evict. |

## Deploy Steps

Order matters — Vercel first (enable backend) → Fly second (start consuming):

1. Vercel Marketplace → install Upstash Redis → auto-add `KV_REST_API_URL`, `KV_REST_API_TOKEN` env vars
2. Local: `vercel env pull` → `.env.local` populated
3. Refactor backend (`push-redis.ts`, `/api/push/register` swap, `/api/push/unregister` new)
4. Refactor frontend (`unsubscribe`, polling skip)
5. `git push main` → Vercel auto-deploy
6. Local: signup Fly.io → `brew install flyctl` → `flyctl auth login`
7. `cd keeper-bot` → `flyctl launch` (name `stacksport-push-worker`, region `sin`, no immediate deploy)
8. `flyctl secrets set UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... VAPID_SUBJECT=... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...`
9. `flyctl deploy`
10. `flyctl logs -a stacksport-push-worker` → verify loop khởi động, đọc Redis OK

## Testing

- **Manual / dev**: local Next.js + local push-worker dev (`npm run push` trong `keeper-bot/`) đọc Redis production (hoặc separate dev DB), simulate alert trigger bằng cách edit alert threshold sát giá hiện tại.
- **Production smoke**: tạo alert thật trên app deployed, click "Bật thông báo", chấp nhận browser permission, edit threshold sát giá. Đợi tối đa 15 phút, native OS notification xuất hiện.
- **E2E** (defer): Playwright test mock push subscription + alert trigger có thể thêm sau.

## File Manifest

**New**:
- `src/lib/push-redis.ts`
- `src/app/api/push/unregister/route.ts`
- `keeper-bot/fly.toml`
- `keeper-bot/Dockerfile`
- `keeper-bot/src/redis-store.ts`

**Modified**:
- `src/app/api/push/register/route.ts` (swap storage)
- `src/hooks/usePushNotifications.ts` (add `unsubscribe`)
- `src/hooks/usePriceAlertPolling.ts` (coexistence skip)
- `keeper-bot/src/push-worker.ts` (Redis read, 15-min cadence)
- `keeper-bot/src/price-push.ts` (drop file I/O, Redis-driven)
- `keeper-bot/package.json` (`@upstash/redis` dep, scripts)
- `package.json` (root, `@upstash/redis` dep)
- `data/push-subscriptions.json` (DELETE local file post-deploy — optional cleanup)

**Deleted**:
- `src/lib/push-storage.ts`

**Unchanged**:
- `src/components/price-alerts/PriceAlertForm.tsx`
- `src/store/priceAlertStore.ts` (transparently switches backend)
- `src/app/api/push/vapid-key/route.ts`
- `public/sw.js` (verify, no edit unless missing push handler)
- Smart contracts, DCA keeper (`keeper-bot/src/index.ts`), DCA execution watcher (Apr 26 spec)

## Open Questions

None. Tất cả scope decisions đã chốt qua brainstorming.
