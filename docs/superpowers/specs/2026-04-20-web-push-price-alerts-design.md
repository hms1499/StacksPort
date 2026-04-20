# Web Push Price Alerts — Design Spec

**Date:** 2026-04-20  
**Status:** Approved

## Overview

Upgrade price alerts từ client-side polling (60s) lên Web Push Notifications — hoạt động ngay cả khi browser đóng hoặc app ở background trên mobile.

## Goals

- Alerts kích hoạt trong vòng ~10 giây khi giá chạm mốc
- Hoạt động trên mobile khi tab/app đóng
- Không cần thêm database hay infrastructure mới
- Giữ alert config tại client (Zustand), server chỉ lưu subscription + mirror của active alerts

## Non-goals

- SSE / real-time streaming trong app (để sau)
- Keeper bot execution notifications (để sau)
- Email / Telegram push (ngoài scope)

## Architecture

Ba layers phối hợp:

### 1. Browser (Next.js client)

**Service Worker** (`public/sw.js`)
- Đăng ký khi app load
- Nhận `push` event từ browser vendor
- Hiển thị native notification với title, body, icon
- Click notification → focus hoặc mở `/notifications`

**`usePushNotifications` hook** (`src/hooks/usePushNotifications.ts`)
- Expose: `{ permission, subscribe, unsubscribe, isSupported }`
- Khi `subscribe()`: fetch VAPID public key từ `/api/push/vapid-key`, gọi `pushManager.subscribe()`, POST subscription lên `/api/push/register`
- Không tự động xin permission — chờ user action

**`priceAlertStore` (update)** (`src/store/priceAlertStore.ts`)
- Sau mỗi `addAlert`, `removeAlert`, `updateAlert`: nếu push permission đã granted, gọi `/api/push/register` với toàn bộ active alerts

### 2. Next.js API Routes

**`POST /api/push/register`**
- Body: `{ walletAddress, subscription, alerts[] }`
- Đọc `data/push-subscriptions.json`, upsert entry theo walletAddress, ghi lại (atomic write)
- Trả về `{ ok: true }`

**`GET /api/push/vapid-key`**
- Trả về `{ publicKey: process.env.VAPID_PUBLIC_KEY }`

### 3. Keeper Bot

**`price-push.ts`** (`keeper-bot/src/price-push.ts`)
- Export `startPricePushLoop(intervalMs = 10_000)`
- Đường dẫn JSON: `../data/push-subscriptions.json` (relative từ `keeper-bot/`)
- Mỗi interval:
  1. Đọc `../data/push-subscriptions.json`
  2. Collect tất cả unique `geckoId` từ active alerts
  3. Batch fetch giá từ CoinGecko
  4. Với mỗi alert: check condition, skip nếu `lastPushedAt` < 60 phút trước
  5. Nếu triggered: gửi Web Push qua `web-push` library, cập nhật `lastPushedAt` trong JSON

**`keeper-bot/src/index.ts`** (update)
- Gọi `startPricePushLoop()` khi bot khởi động, chạy song song với DCA execution loop

## Data Model

**`data/push-subscriptions.json`**

```json
{
  "SP2CMK...walletAddr": {
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/...",
      "keys": { "auth": "...", "p256dh": "..." }
    },
    "alerts": [
      {
        "id": "alert-123",
        "tokenSymbol": "BTC",
        "geckoId": "bitcoin",
        "condition": "below",
        "targetPrice": 90000,
        "isActive": true,
        "lastPushedAt": null
      }
    ],
    "updatedAt": 1776689635000
  }
}
```

## UX Flow

1. User tạo price alert lần đầu → banner xuất hiện: *"Bật thông báo để nhận alert khi đóng app?"* + nút **Bật thông báo**
2. User click → browser hiện native permission dialog
3. Grant → hook subscribe, POST lên server
4. Keeper bot bắt đầu monitor trong vòng 10s

Notification format:
- **Title:** `StacksPort — Price Alert`
- **Body:** `BTC xuống dưới $90,000 — giá hiện tại: $89,420`
- **Click:** mở `/notifications`

## Edge Cases

| Case | Xử lý |
|------|--------|
| Push spam | `lastPushedAt` — không push lại cùng alert trong 60 phút |
| CoinGecko down | Bỏ qua cycle, retry sau 10s |
| Subscription expired (410 Gone) | Keeper bot xóa entry khỏi JSON |
| User xóa alert | `priceAlertStore` gọi lại `/api/push/register` với list mới |
| File race condition | Atomic write: ghi temp file → rename |
| User deny permission | Alerts vẫn hoạt động trong app, chỉ không có push |

## Files Thêm / Sửa

| File | Trạng thái |
|------|------------|
| `public/sw.js` | Mới |
| `src/hooks/usePushNotifications.ts` | Mới |
| `src/app/api/push/register/route.ts` | Mới |
| `src/app/api/push/vapid-key/route.ts` | Mới |
| `data/push-subscriptions.json` | Mới (empty `{}`) |
| `keeper-bot/src/price-push.ts` | Mới |
| `keeper-bot/src/index.ts` | Sửa — thêm `startPricePushLoop()` |
| `src/store/priceAlertStore.ts` | Sửa — sync to server sau mỗi mutation |
| `keeper-bot/.env` | Sửa — thêm `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| `.env.local` | Sửa — thêm `VAPID_PUBLIC_KEY` |

## Environment Variables

```bash
# keeper-bot/.env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:thanvanhuyy@gmail.com

# .env.local (Next.js)
VAPID_PUBLIC_KEY=...
```

## Dependencies

```bash
# keeper-bot
npm install web-push
npm install --save-dev @types/web-push
```
