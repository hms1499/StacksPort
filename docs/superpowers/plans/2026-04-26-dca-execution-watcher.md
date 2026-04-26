# DCA Execution Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi keeper bot tự execute một DCA plan (mỗi 15 phút), user nhận được notification trong app — không cần web push, không cần backend thay đổi.

**Architecture:** Một client-side hook `useDcaExecutionWatcher` mount ở `layout-client.tsx` (giống pattern `<PriceAlertPoller />`). Hook poll `getPlanExecutionHistory` mỗi 60s khi tab visible, diff với danh sách txid đã thấy lưu trong `localStorage`, push notification mới vào `notificationStore`.

**Tech Stack:** React 19, Next.js 15 App Router, Zustand, TypeScript. Repo không có vitest/jest — verify bằng manual smoke test.

**Spec:** `docs/superpowers/specs/2026-04-26-dca-execution-watcher-design.md`

---

## File Structure

**New**:
- `src/lib/dca-watcher-storage.ts` — pure helpers cho seen-txid persistence (no React, no side-effect ngoài localStorage)
- `src/hooks/useDcaExecutionWatcher.ts` — React hook orchestrate baseline + polling + visibility

**Modified**:
- `src/app/layout-client.tsx` — thêm sentinel component `<DcaExecutionWatcher />`

---

### Task 1: Storage helpers

Pure module quản lý seen-txid set per wallet. Không React, không async — chỉ đọc/ghi `localStorage`.

**Files:**
- Create: `src/lib/dca-watcher-storage.ts`

- [ ] **Step 1: Tạo file với types, constants, key helper**

```ts
// src/lib/dca-watcher-storage.ts

const KEY_PREFIX = 'dca-watcher-seen:';
const MAX_TXIDS = 500;

export interface SeenStore {
  txids: string[];
  baselineDoneAt: number; // 0 = chưa baseline; ms timestamp khi xong
}

function emptyStore(): SeenStore {
  return { txids: [], baselineDoneAt: 0 };
}

function storageKey(address: string): string {
  return `${KEY_PREFIX}${address.toLowerCase()}`;
}
```

- [ ] **Step 2: Thêm `loadSeen` và `saveSeen`**

Append vào `src/lib/dca-watcher-storage.ts`:

```ts
export function loadSeen(address: string): SeenStore {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<SeenStore>;
    return {
      txids: Array.isArray(parsed.txids) ? parsed.txids : [],
      baselineDoneAt: typeof parsed.baselineDoneAt === 'number' ? parsed.baselineDoneAt : 0,
    };
  } catch {
    return emptyStore();
  }
}

export function saveSeen(address: string, store: SeenStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(address), JSON.stringify(store));
  } catch {
    // quota exceeded / private mode — silently ignore
  }
}
```

- [ ] **Step 3: Thêm baseline + seen helpers**

Append vào `src/lib/dca-watcher-storage.ts`:

```ts
export function isBaselined(store: SeenStore): boolean {
  return store.baselineDoneAt > 0;
}

export function markBaselined(store: SeenStore): SeenStore {
  return { ...store, baselineDoneAt: Date.now() };
}

/**
 * Add new txids to the seen set, dedup, FIFO trim to MAX_TXIDS.
 */
export function markSeen(store: SeenStore, txids: string[]): SeenStore {
  if (txids.length === 0) return store;
  const set = new Set(store.txids);
  for (const id of txids) set.add(id);
  let next = Array.from(set);
  if (next.length > MAX_TXIDS) {
    next = next.slice(next.length - MAX_TXIDS);
  }
  return { ...store, txids: next };
}

export function hasSeen(store: SeenStore, txid: string): boolean {
  return store.txids.includes(txid);
}
```

- [ ] **Step 4: Verify type-check**

Run:
```bash
npx tsc --noEmit -p .
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dca-watcher-storage.ts
git commit -m "feat(dca): add seen-txid storage helpers for execution watcher"
```

---

### Task 2: Watcher hook

Build complete hook in one shot — module nhỏ (~120 dòng) và phụ thuộc nhau, split sẽ tạo intermediate state với unused imports.

**Files:**
- Create: `src/hooks/useDcaExecutionWatcher.ts`

- [ ] **Step 1: Tạo file với toàn bộ hook**

```ts
// src/hooks/useDcaExecutionWatcher.ts
'use client';

import { useEffect, useRef } from 'react';
import { useWalletStore } from '@/store/walletStore';
import { useNotificationStore } from '@/store/notificationStore';
import {
  getUserPlans,
  getPlanExecutionHistory,
  microToSTX,
  type DCAPlan,
  type PlanExecutionEvent,
} from '@/lib/dca';
import {
  loadSeen,
  saveSeen,
  isBaselined,
  markBaselined,
  markSeen,
  hasSeen,
} from '@/lib/dca-watcher-storage';

const POLL_INTERVAL_MS = 60_000;

type AddNotificationFn = ReturnType<typeof useNotificationStore.getState>['addNotification'];

export function useDcaExecutionWatcher(): void {
  const stxAddress = useWalletStore((s) => s.stxAddress);
  const addNotification = useNotificationStore((s) => s.addNotification);

  // Ref so async loops always see latest fn without re-subscribing
  const addNotificationRef = useRef(addNotification);
  useEffect(() => { addNotificationRef.current = addNotification; }, [addNotification]);

  useEffect(() => {
    if (!stxAddress) return;
    const address = stxAddress;
    let cancelled = false;
    let isRunning = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isRunning) return;
      isRunning = true;
      try {
        await runTick(address, addNotificationRef.current);
      } catch {
        // never throw out of interval callback
      } finally {
        isRunning = false;
      }
    };

    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        // catch-up immediately when tab becomes visible
        void tick();
      }
    };

    void (async () => {
      const initial = loadSeen(address);
      if (!isBaselined(initial)) {
        await runBaseline(address);
      }
      if (cancelled) return;
      void tick();
      intervalId = setInterval(tick, POLL_INTERVAL_MS);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibility);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [stxAddress]);
}

async function runBaseline(address: string): Promise<void> {
  let store = loadSeen(address);
  try {
    const plans = await getUserPlans(address);
    const allTxids: string[] = [];
    for (const plan of plans) {
      try {
        const events = await getPlanExecutionHistory(plan.id);
        for (const ev of events) allTxids.push(ev.txId);
      } catch {
        // skip plan on error
      }
    }
    store = markSeen(store, allTxids);
  } finally {
    store = markBaselined(store);
    saveSeen(address, store);
  }
}

async function runTick(address: string, addNotification: AddNotificationFn): Promise<void> {
  let plans: DCAPlan[];
  try {
    plans = await getUserPlans(address);
  } catch {
    return;
  }
  if (plans.length === 0) return;

  let store = loadSeen(address);
  const newTxids: string[] = [];

  for (const plan of plans) {
    let events: PlanExecutionEvent[];
    try {
      events = await getPlanExecutionHistory(plan.id);
    } catch {
      continue;
    }

    const fresh = events
      .filter((e) => !hasSeen(store, e.txId) && !newTxids.includes(e.txId))
      .filter((e) => e.status === 'success' || e.status === 'failed')
      .sort((a, b) => a.blockTime - b.blockTime);

    for (const ev of fresh) {
      notifyEvent(addNotification, plan, ev);
      newTxids.push(ev.txId);
    }
  }

  if (newTxids.length > 0) {
    store = markSeen(store, newTxids);
    saveSeen(address, store);
  }
}

function notifyEvent(
  addNotification: AddNotificationFn,
  plan: DCAPlan,
  ev: PlanExecutionEvent
): void {
  const context = {
    planId: String(plan.id),
    txId: ev.txId,
    action: 'executed',
  };
  if (ev.status === 'success') {
    const swapped =
      ev.netSwapped !== undefined
        ? ` — swapped ${microToSTX(ev.netSwapped).toFixed(4)} STX → sBTC`
        : '';
    addNotification(
      `Plan #${plan.id} executed${swapped}`,
      'success',
      'dca',
      undefined, // no auto-dismiss; keep in store
      context
    );
  } else {
    addNotification(
      `Plan #${plan.id} execution failed`,
      'error',
      'dca',
      undefined,
      context
    );
  }
}
```

- [ ] **Step 2: Verify type-check**

Run:
```bash
npx tsc --noEmit -p .
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDcaExecutionWatcher.ts
git commit -m "feat(dca): add execution watcher hook with baseline and polling"
```

---

### Task 3: Mount in layout

Mount hook qua sentinel component theo pattern hiện có (`<PriceAlertPoller />`, `<PushSyncer />`).

**Files:**
- Modify: `src/app/layout-client.tsx`

- [ ] **Step 1: Thêm import**

Trong `src/app/layout-client.tsx`, thêm import sau dòng `import { usePushNotifications } from '@/hooks/usePushNotifications';`:

```ts
import { useDcaExecutionWatcher } from '@/hooks/useDcaExecutionWatcher';
```

- [ ] **Step 2: Thêm sentinel component**

Sau `function PushSyncer() { ... }`, thêm:

```tsx
function DcaExecutionWatcher() {
  useDcaExecutionWatcher();
  return null;
}
```

- [ ] **Step 3: Render sentinel**

Trong JSX, sau `<PushSyncer />` (trong block `{/* Background services */}`), thêm:

```tsx
<DcaExecutionWatcher />
```

Block sau khi sửa:
```tsx
{/* Background services */}
<PriceAlertPoller />
<WalletAddressSync />
<PushSyncer />
<DcaExecutionWatcher />
```

- [ ] **Step 4: Verify type-check + lint**

Run:
```bash
npx tsc --noEmit -p . && npm run lint
```
Expected: cả hai pass cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout-client.tsx
git commit -m "feat(dca): mount execution watcher app-wide"
```

---

### Task 4: Manual smoke test

Build chạy ổn và behavior khớp spec.

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run:
```bash
npm run build
```
Expected: build succeeds, no type/lint errors. Nếu fail, fix root cause trước khi tiếp.

- [ ] **Step 2: Dev server smoke**

Start dev server in background:
```bash
npm run dev
```

Mở browser tới `http://localhost:3000/dca`, connect wallet (mainnet address có ≥1 plan), mở DevTools → Application → Local Storage.

Expected:
- Sau ~2-5s sau khi connect, key `dca-watcher-seen:<your-address-lowercase>` xuất hiện trong Local Storage
- Value JSON có `baselineDoneAt > 0` và `txids` array chứa toàn bộ tx id từ history hiện tại
- Notification drawer **không** hiện noti DCA mới (silent baseline)
- DevTools Console không có lỗi

- [ ] **Step 3: Verify visibility behavior**

Switch tab khỏi browser ≥60s, switch lại. Expected: 1 tick chạy ngay khi tab visible (không error trong console).

(Verify trực tiếp tick không khả thi nếu không mock new tx — coi như pass nếu console clean và baseline đúng. Validation thực sự là khi keeper bot bắn tx mới user sẽ thấy noti — verify ở runtime.)

- [ ] **Step 4: Free port 3000**

Stop dev server (Ctrl+C hoặc kill background process):

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
```

- [ ] **Step 5: Commit (conditional)**

Nếu có file thay đổi do fix nhỏ phát sinh trong smoke test, commit. Nếu không, skip — feature đã commit ở Task 1-3.

---

## Self-Review Checklist (post-write)

- ✅ **Spec coverage**: Architecture (Task 2-3), Storage & Baseline (Task 1, runBaseline trong Task 2), Data Flow (runTick trong Task 2), Notify mapping (notifyEvent trong Task 2), Lifecycle/cleanup (useEffect return trong Task 2), Edge cases all handled (try/catch per plan, visibility check, cancelled flag, isRunning guard, FIFO trim trong markSeen, address lowercase trong storage). Testing → Task 4 manual; e2e/unit explicitly out of scope per spec.
- ✅ **No placeholders**: Mọi code step có actual code. Type names match across tasks (`SeenStore`, `markSeen`, `hasSeen`, `isBaselined`, `markBaselined`, `loadSeen`, `saveSeen`, `notifyEvent`, `runTick`, `runBaseline`, `AddNotificationFn`).
- ✅ **DRY/YAGNI**: Một hook, một storage module, không abstract cho future use. Không env vars, không config. Polling interval và max txids hardcode constants.
- ✅ **TDD**: Skipped — repo không có unit-test framework (per spec). Manual smoke test ở Task 4 là verification gate. Type-check sau mỗi task code.
- ✅ **Frequent commits**: 3 functional commits + 1 conditional smoke-test commit.
