# E2E Frontend Tests Design - StacksPort

## Overview

End-to-end frontend test suite using Playwright for StacksPort — a DCA & Portfolio platform on Stacks blockchain. Tests cover all 7 pages across guest and connected wallet states, on desktop and mobile viewports.

## Framework

- **Playwright** with TypeScript
- Page-based test file structure (1 file per page)
- Parallel execution per file

## Architecture

```
e2e/
├── fixtures/
│   └── test-utils.ts       # Mock wallet helper, API mock helpers, shared constants
├── landing.spec.ts          # Guest: hero, features, CTA, navigation
├── dashboard.spec.ts        # Connected: balance card, market stats, widgets
├── trade.spec.ts            # Connected: swap widget, token select, form validation
├── dca.spec.ts              # Connected: create plan form, plan list, stats
├── assets.spec.ts           # Connected: holdings, PnL, stacking tracker
├── notifications.spec.ts   # Connected: alert form, filters, notification cards
├── navigation.spec.ts      # Both states: sidebar (desktop), bottom nav (mobile), routing
└── ai.spec.ts               # Connected: AI insights page render
```

## Wallet Mock Strategy

Inject Zustand `walletStore` state via `page.addInitScript()` before page load:

- **Guest state**: default (`isConnected: false`)
- **Connected state**: mock `isConnected: true`, `stxAddress: 'SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV'`, `btcAddress: 'bc1qtest...'`

This avoids any dependency on real wallet extensions (Leather/Xverse).

## API Mock Strategy

Use `page.route()` to intercept external API calls:

| Route pattern | Mock data |
|---------------|-----------|
| `/api/coingecko/*` | Static price data (STX, BTC, sBTC) |
| `/api/bitflow/*` | Swap quotes, token list |
| `/api/news` | Sample news articles |
| `/api/ai/insights` | Mock AI analysis response |
| `api.hiro.so/*` | Balance, transaction history |

## Browser & Viewport Configuration

| Profile | Browser | Viewport | Purpose |
|---------|---------|----------|---------|
| Desktop | Chromium | 1280x720 | Sidebar layout, full desktop UI |
| iPhone 14 | WebKit | 390x844 | BottomNav, iOS responsive |
| Pixel 7 | Chromium | 412x915 | Android responsive |

## Test Scenarios

### landing.spec.ts (Guest)
- Hero section renders: title, subtitle, "Launch App" button
- Features section: 6 feature cards visible
- Stats strip: 4 stat items
- How-it-works: 3 steps render
- CTA section: "Connect Wallet" button
- "See Features" link scrolls to features section
- "Launch App" button triggers wallet connect flow

### dashboard.spec.ts (Connected)
- Balance card renders with mock data
- Welcome steps component visible for new users
- Quick actions buttons present
- Market stats cards render (skeleton → loaded)
- Greed Index card renders
- Trending tokens list renders
- Crypto news section renders
- Recent activity section renders

### trade.spec.ts (Connected)
- Swap widget renders with default token pair
- Token selector opens/closes
- Amount input accepts numeric values
- Amount input rejects non-numeric
- Quote updates when amount changes
- Swap button disabled when amount is 0
- Swap button shows "Insufficient balance" when amount exceeds balance
- Token pair can be reversed (flip button)

### dca.spec.ts (Connected)
- Create plan form renders all fields
- Amount input validation (min amount)
- Interval selector options available
- Form submission with valid data
- Plan cards render in list
- Plan card shows status (active, paused)
- Pause/Resume button toggles plan state
- DCA stats section renders

### assets.spec.ts (Connected)
- Portfolio summary card with total value
- Token holdings list renders
- PnL tracker renders chart
- Health score indicator
- Stacking tracker section
- sBTC monitor section
- Empty state when no holdings

### notifications.spec.ts (Connected)
- Price alert form: token select, target price input, direction (above/below)
- Alert creation with valid data
- Alert list renders created alerts
- Filter tabs (all, price, execution)
- Notification cards render with correct data
- Empty state when no notifications
- Delete/dismiss notification

### navigation.spec.ts (Both states)
- Desktop: sidebar renders with all nav links
- Desktop: clicking nav link navigates to correct page
- Desktop: active link highlighted
- Mobile: bottom nav renders with nav items
- Mobile: sidebar hidden
- Mobile: bottom nav active state
- Guest redirect: accessing /dashboard redirects to landing
- Connected: accessing / redirects to /dashboard

### ai.spec.ts (Connected)
- AI page renders
- Insight cards render with mock data
- Sentiment card renders
- Trend analysis card renders
- News digest card renders

## CI Integration

- `npm run test:e2e` script in package.json
- Can be added to GitHub Actions workflow later
- Playwright HTML report for test results
