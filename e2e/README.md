# E2E Testing Guide — StacksPort

End-to-end tests sử dụng [Playwright](https://playwright.dev), chạy trên local dev server. Tests bao phủ toàn bộ 7 trang của ứng dụng ở cả trạng thái **guest** (chưa kết nối ví) và **connected** (đã kết nối ví), trên 3 browser profiles.

---

## Cấu trúc thư mục

```
e2e/
├── fixtures/
│   └── test-utils.ts        # Mock wallet, mock API helpers
├── ai.spec.ts               # Trang Stacks AI
├── assets.spec.ts           # Trang My Assets
├── dashboard.spec.ts        # Trang Dashboard
├── dca.spec.ts              # Trang DCA Vault
├── landing.spec.ts          # Trang Landing (guest)
├── navigation.spec.ts       # Sidebar, bottom nav, routing
├── notifications.spec.ts    # Trang Alerts
└── trade.spec.ts            # Trang Trade / Swap
```

---

## Test coverage

| File | Trang | Scenarios |
|------|-------|-----------|
| `landing.spec.ts` | Landing | Hero, features, stats, CTA, navbar, footer |
| `dashboard.spec.ts` | Dashboard | Balance card, market stats, news, activity |
| `trade.spec.ts` | Trade | Swap widget, token select, form validation |
| `dca.spec.ts` | DCA Vault | Create plan, tabs, stats, guest state |
| `assets.spec.ts` | My Assets | Portfolio, holdings, PnL, stacking, sBTC |
| `notifications.spec.ts` | Alerts | Filters, search, sort, empty state |
| `navigation.spec.ts` | Tất cả | Sidebar (desktop), bottom nav (mobile), routing |
| `ai.spec.ts` | Stacks AI | AI insights cards, error state |

---

## Browser profiles

| Profile | Device | Viewport |
|---------|--------|----------|
| `desktop-chromium` | Desktop Chrome | 1280×720 |
| `mobile-iphone` | iPhone 14 | 390×844 |
| `mobile-android` | Pixel 7 | 412×915 |

> **Lưu ý:** Sidebar tests tự động skip trên mobile vì sidebar bị ẩn (`hidden md:block`).

---

## Cài đặt lần đầu

```bash
# Cài Playwright browsers (chỉ cần chạy 1 lần)
npx playwright install chromium
```

---

## Chạy test

### Chạy toàn bộ (tất cả profiles)

```bash
npm run test:e2e
```

### Chạy từng profile

```bash
# Desktop Chrome
npx playwright test --project=desktop-chromium

# Mobile iPhone 14
npx playwright test --project=mobile-iphone

# Mobile Android Pixel 7
npx playwright test --project=mobile-android
```

### Chạy từng trang (tất cả profiles)

```bash
npx playwright test e2e/landing.spec.ts
npx playwright test e2e/dashboard.spec.ts
npx playwright test e2e/trade.spec.ts
npx playwright test e2e/dca.spec.ts
npx playwright test e2e/assets.spec.ts
npx playwright test e2e/notifications.spec.ts
npx playwright test e2e/navigation.spec.ts
npx playwright test e2e/ai.spec.ts
```

### Chạy từng trang trên profile cụ thể

```bash
npx playwright test e2e/dashboard.spec.ts --project=desktop-chromium
npx playwright test e2e/trade.spec.ts --project=mobile-iphone
```

### Chạy 1 test cụ thể

```bash
npx playwright test --project=desktop-chromium -g "tên test"

# Ví dụ:
npx playwright test --project=desktop-chromium -g "renders Dashboard title"
```

---

## Debug

### Xem browser chạy thật (headed mode)

```bash
npx playwright test --headed
npx playwright test e2e/dashboard.spec.ts --headed --project=desktop-chromium
```

### Mở Playwright UI (khuyến nghị để debug)

```bash
npx playwright test --ui
```

Playwright UI cho phép:
- Chọn và chạy từng test riêng lẻ
- Xem screenshot từng bước
- Xem timeline thực thi
- Lọc theo profile / spec file

### Xem báo cáo HTML sau khi chạy xong

```bash
npx playwright show-report
```

Báo cáo HTML hiển thị:
- Pass / fail từng test
- Screenshot khi test thất bại
- Trace step-by-step cho các test được retry

---

## Kết quả mong đợi

```
Desktop Chromium  84 passed   0 failed
Mobile iPhone 14  78 passed   5 skipped   0 failed
Mobile Android    79 passed   5 skipped   0 failed
```

> 10 tests skipped là Desktop Sidebar tests trên mobile — đây là expected behavior.
