# DCA Execution Watcher — Design Spec

**Date:** 2026-04-26
**Status:** Approved

## Overview

Đóng UX gap giữa keeper bot tự động và user: khi keeper execute một DCA plan (mỗi 15 phút qua cron), user hiện không nhận được tín hiệu nào trong app. Spec này thêm một client-side watcher chạy app-wide, polling on-chain execution history, và đẩy notification vào `notificationStore` cho mỗi tx mới (success hoặc fail).

Approach: **client-side polling**. Không thay đổi keeper bot, không thêm backend storage, không dùng web push.

## Goals

- User nhận được notification trong app khi plan của họ execute thành công hoặc fail
- Hoạt động ở mọi page trong app sau khi connect wallet
- Không spam: lần đầu connect không bắn notification cho tx cũ
- Tiết kiệm RPC: pause polling khi tab inactive, resume + catch-up khi visible lại

## Non-goals

- **Web Push** (cần tab open) — feature riêng sau
- **sBTC→USDCx vault** (`dca-sbtc.ts` chưa có history fetcher) — follow-up riêng
- **Cross-tab dedup** — nếu user mở 2 tab, chấp nhận noti trùng
- **Backend / keeper bot changes** — không sửa
- **Pending tx notification** — chỉ notify khi tx đạt trạng thái terminal

## Architecture

Một hook + một storage helper, chạy ở app shell.

### Components

**`src/hooks/useDcaExecutionWatcher.ts`** (mới)

- Mount một lần ở app shell
- Đọc `address` từ `useWalletStore`
- Quản lý lifecycle: baseline → polling loop → pause/resume theo `visibilitychange` → cleanup khi wallet disconnect/switch
- Concurrency guard: cờ `isRunning` để skip tick mới khi tick trước chưa xong

**`src/lib/dca-watcher-storage.ts`** (mới)

- Helper đọc/ghi seen-txid set vào `localStorage`
- Per-wallet scoping qua key `dca-watcher-seen:{address}`
- API: `loadSeen(address)`, `saveSeen(address, store)`, `markSeen(store, txids[])`, `isBaselined(store)`

**App shell mount point** (sửa)

- Mount hook trong `src/components/layout/AppShell.tsx` hoặc tương đương — cần xác định file chính xác trong implementation plan
- Phải mount **sau** wallet provider, **trước** hoặc song song với toast container

### Dependencies (read-only)

- `useWalletStore` — `address`
- `useNotificationStore` — `addNotification`
- `getDcaUserPlans(address)` từ `src/lib/dca.ts`
- `getPlanExecutionHistory(planId)` từ `src/lib/dca.ts`

Không thêm dependency npm mới.

## Data Flow

### Polling tick (60s, chỉ khi `document.hidden === false`)

```
1. plans = await getDcaUserPlans(address)
2. seen = loadSeen(address)
3. for each plan:
     try:
       events = await getPlanExecutionHistory(plan.id)
       newEvents = events
         .filter(e => !seen.txids.has(e.txId))
         .filter(e => e.status !== "pending")
         .sort(asc by blockTime)
       for each newEvent:
         notify(newEvent, plan)
         seen.txids.add(e.txId)
     catch err:
       log warn, continue (don't fail other plans)
4. trim seen.txids to FIFO max 500
5. saveSeen(address, seen)
```

### Notify mapping

| `event.status`      | Notification type | Message                                                 |
| ------------------- | ----------------- | ------------------------------------------------------- |
| `success`           | `success`         | `Plan #{id} executed — swapped {netSwapped} STX → sBTC` |
| anything else       | `error`           | `Plan #{id} execution failed`                           |

Mọi notification: `category: "dca"`, `context: { planId: String(id), txId, action: "executed" }`.

`netSwapped` format: `microToSTX(ev.netSwapped).toFixed(4)` (giống `HistoryTab.tsx`). Nếu `netSwapped` undefined, bỏ phần " — swapped ..." trong message.

### Plan list refresh

Gọi `getDcaUserPlans` mỗi tick, không cache. Đảm bảo plan mới user vừa tạo cũng được watch ngay tick kế tiếp. Plan đã cancel/complete vẫn còn trong list contract → không cần xử lý đặc biệt.

## Storage & Baseline

### LocalStorage shape

```ts
type SeenStore = {
  txids: string[];        // dedup khi load (set), max 500 entries (FIFO trim)
  baselineDoneAt: number; // 0 nếu chưa baseline; timestamp ms khi baseline xong
};
```

Key: `dca-watcher-seen:{address}` (lowercase address để match cách store khác trong app).

### Baseline flow

Lần đầu wallet connect (hoặc address chưa từng baseline):

1. `loadSeen(address)` → nếu `baselineDoneAt === 0`:
   - Fetch tất cả plans + history (bao gồm pending)
   - Push **mọi txid** vào `seen.txids`
   - Set `baselineDoneAt = Date.now()`
   - Save
   - **Không** notify gì
2. Bắt đầu polling loop bình thường

Nếu `baselineDoneAt > 0`: skip baseline, vào polling loop.

**Lý do dùng flag thay vì check empty**: user có thể có 0 plan tại thời điểm baseline; lần sau tạo plan mới, không có flag thì không phân biệt được "chưa baseline" vs "đã baseline rỗng".

### FIFO trim

500 txids ≈ 1 plan/6h × 10 plans × ~12 ngày. Khi vượt cap, drop từ đầu mảng (oldest đã thấy).

### Wallet switch

Address mới → key mới → baseline lại từ đầu cho address đó. Data của address cũ giữ nguyên trong localStorage (không cleanup) — phòng khi user switch lại sau này.

## Lifecycle

```
mount
  ↓
address available?
  no → no-op (cleanup nothing)
  yes ↓
isBaselined(loadSeen(address))?
  no → baseline (silent) → save
  yes ↓
start interval (60s tick)
add visibilitychange listener
  ↓
on tick (only when !document.hidden && !isRunning):
  isRunning = true
  poll → notify diff → save
  isRunning = false
  ↓
on visibility → visible:
  one-shot tick immediately (skip 60s wait)
  ↓
on address change (wallet switch / disconnect):
  clearInterval + remove listener
  if new address: re-run from "address available?" branch
  ↓
on unmount:
  clearInterval + remove listener
```

## Edge Cases

| Case                                  | Behavior                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| User chưa connect wallet              | Hook no-op, không poll                                                                                             |
| Wallet disconnect giữa chừng          | Clear interval, giữ nguyên `seenTxids` trong localStorage                                                          |
| User không có plan nào                | Tick chạy nhưng vòng lặp rỗng — chi phí ~1 RPC call (`getDcaUserPlans`)                                            |
| Tx pending → success cùng tick        | Pending bị filter; tx được add vào `seenTxids` ở tick mà nó đầu tiên xuất hiện ở trạng thái terminal               |
| Tab inactive >1h                      | Resume → 1-shot catch-up; tất cả tx mới trong khoảng đó sẽ được notify (oldest → newest) — chấp nhận burst         |
| RPC trả về duplicate event            | `seenTxids` là Set khi check → dedup tự động                                                                       |
| User clear localStorage               | Coi như user mới → baseline lại, không spam                                                                        |
| `getPlanExecutionHistory` throw       | Try/catch quanh từng plan, fail 1 plan không block plan khác. Log warn (no notification)                           |
| `getDcaUserPlans` throw               | Skip tick, log warn, tick sau thử lại                                                                              |
| 2 tab cùng mở                         | Có thể notify trùng — chấp nhận (YAGNI cross-tab dedup)                                                            |

## Testing

- **Unit**: `dca-watcher-storage.ts` — baseline detection, dedup, FIFO trim, address scoping. Repo hiện không có vitest setup → nếu plan thêm vitest là over-scope, viết as plain TS module với manual test trong dev và bỏ unit test khỏi scope.
- **Manual / dev**: connect wallet với plan thật, đợi keeper run (15p) hoặc tự gọi `executeSBTCPlan` từ UI, verify notification xuất hiện trong drawer + notifications page với đúng category/message.
- **E2E** (Playwright, optional follow-up): mock `getPlanExecutionHistory` trong fixture `e2e/fixtures/test-utils.ts`, verify notification appears sau khi mock trả về tx mới. Có thể defer sang spec sau.

## Implementation Notes

- Polling interval `60_000` ms — hardcode, không cần env var (YAGNI)
- Max 500 seen txids — hardcode constant trong `dca-watcher-storage.ts`
- Address phải lowercase trước khi dùng làm storage key (Stacks addresses case-sensitive nhưng walletStore có thể trả nhiều shape — verify trong implementation)
- Hook trả về `void` — không expose state ra UI (silent background worker)
- Không cần `useEffect` cleanup race condition handling phức tạp: cờ `isRunning` + clearInterval đã đủ

## File Manifest

**New**:
- `src/hooks/useDcaExecutionWatcher.ts`
- `src/lib/dca-watcher-storage.ts`

**Modified**:
- `src/components/layout/AppShell.tsx` (hoặc file mount point chính xác — xác định trong plan): thêm 1 dòng `useDcaExecutionWatcher()`

**Unchanged**:
- `keeper-bot/*` — không sửa
- `notificationStore`, `dca.ts` — không sửa
- Smart contracts — không sửa

## Open Questions

Không có. Tất cả scope decisions đã chốt qua brainstorming.
