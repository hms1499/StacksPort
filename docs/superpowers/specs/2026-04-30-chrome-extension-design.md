# Chrome Side Panel Extension — Design Spec

**Date:** 2026-04-30  
**Project:** StacksPort  
**Approach:** Hybrid — Side Panel + Smart Background (Option B)  
**Target:** Personal use first, publish to Chrome Web Store later  
**Vercel URL:** `https://stack-sport.vercel.app`

---

## Overview

A Chrome Extension that wraps the existing StacksPort Next.js app as a Side Panel, adding a quick-stats popup and native browser notifications. Zero refactor of the main app — the extension is a standalone `extension/` directory with minimal changes to two web app files.

---

## Architecture

### Components

| File | Role |
|---|---|
| `extension/manifest.json` | MV3 manifest — permissions, icons, CSP, content script config |
| `extension/background.js` | Service worker — polls prices, checks alerts, fires notifications |
| `extension/popup.html` + `popup.js` | Toolbar popup — prices, portfolio, recent notifications (read-only) |
| `extension/side_panel.html` + `side_panel.js` | Side panel — iframe loading `stack-sport.vercel.app` |
| `extension/content_script.js` | Injected into Vercel app — reads wallet address from localStorage |
| `extension/options.html` + `options.js` | Config page — app URL toggle (dev/prod), for future Web Store use |
| `extension/icons/` | 16, 32, 48, 128px PNG icons from brand green `#408A71` |

### Web App Changes (minimal)

| File | Change |
|---|---|
| `src/app/api/coingecko/[...path]/route.ts` | Add CORS header: `Access-Control-Allow-Origin: chrome-extension://*` |
| `src/app/api/extension/summary/route.ts` | New route: returns STX/sBTC prices + portfolio value + 3 recent notifications |
| `next.config.ts` | Add `Content-Security-Policy: frame-ancestors 'self' chrome-extension://*` via `headers()` |

---

## Data Flow

### ① Side Panel — Full App
```
User clicks icon → chrome.sidePanel.open() → iframe loads stack-sport.vercel.app → full Next.js app
```

### ② Wallet & Notifications Sync
```
On every page load (stack-sport.vercel.app):
content_script.js reads:
  - localStorage['stacks-wallet']          → { stxAddress, btcAddress }
  - localStorage['notifications-storage'] → last 3 notifications

→ chrome.runtime.sendMessage({ stxAddress, notifications })
→ background.js stores:
    stxAddress    → chrome.storage.sync   (cross-device)
    notifications → chrome.storage.local  (popup reads this)
→ popup.js renders notifications from chrome.storage.local
```

### ③ Background Polling (every 5 minutes)
Two `chrome.alarms`:
- **`pollPrice`** — fetches `/api/coingecko/simple/price?ids=blockstack,bitcoin&vs_currencies=usd`, compares with previous cached price, fires notification if Δ > 5% (confirmed by 2 consecutive polls)
- **`checkAlerts`** — fetches `/api/extension/summary?address=<stxAddress>`, gets current prices + active priceAlerts in one call, checks if any alert threshold is crossed, fires notification if yes. Stores fired alert IDs in `chrome.storage.local` to prevent duplicate notifications across polls.

### ④ Popup Open
```
Popup opens
→ instantly renders cached data from chrome.storage.local
→ simultaneously fetches /api/extension/summary for fresh data
→ updates UI when fresh data arrives
```

---

## Popup UI

**Size:** 360 × 480px  
**Theme:** Dark, brand green `#408A71`

Sections (top to bottom):
1. **Header** — logo, app name, "Open App →" button (opens side panel)
2. **Live Prices** — STX / sBTC / BTC cards with % 24h change (green/red)
3. **Portfolio** — total USD value, daily change %, mini 7-day sparkline
4. **Recent** — 3 most recent notifications with dot indicator (unread = green)
5. **Footer** — truncated wallet address (`SP2CM...3SV`) + "Updated Xm ago"

---

## `/api/extension/summary` Route

```
GET /api/extension/summary?address=<stxAddress>

Response:
{
  prices: { stx: number, sbtc: number, btc: number, stxChange24h: number },
  portfolio: { totalUsd: number, changeUsd: number, changePct: number, sparkline: number[] },
  priceAlerts: [{ id, tokenSymbol, condition, targetPrice, isActive }]  // active only
}
```

Notifications are NOT returned by this route — they come from `chrome.storage.local` populated by `content_script.js` reading `localStorage['notifications-storage']` directly.

Includes CORS header for `chrome-extension://*`.

---

## Chrome Permissions

```json
{
  "permissions": ["sidePanel", "notifications", "alarms", "storage"],
  "host_permissions": ["https://stack-sport.vercel.app/*"],
  "content_scripts": [{
    "matches": ["https://stack-sport.vercel.app/*"],
    "js": ["content_script.js"]
  }]
}
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Wallet not connected | Portfolio shows "Connect wallet in app". Prices still display. |
| API error / offline | Popup shows cached data with "Stale" badge. Background retries after 1 min. |
| Side panel iframe blocked | Fallback "Open in new tab" button shown. Prevented by adding `frame-ancestors` CSP. |
| Price change false positive | Only notify if 2 consecutive polls confirm the change. Prevents spam from API blips. |

---

## Testing Checklist

### Manual (Chrome DevTools)
- [ ] Load unpacked extension → icon appears in toolbar
- [ ] Click icon → side panel opens, app loads in iframe
- [ ] Connect wallet in app → popup shows portfolio value
- [ ] "Open App" button in popup → side panel opens
- [ ] Background service worker → DevTools → check alarms registered

### Notifications
- [ ] Set threshold to 0.1% temporarily → verify notification fires
- [ ] Set price alert target = current price → verify trigger
- [ ] Go offline → popup shows stale data, no crash

### Pre-publish (Web Store)
- [ ] Options page: change URL → popup uses new URL
- [ ] CSP review: no `unsafe-eval`, no `unsafe-inline`
- [ ] Privacy policy page drafted (Web Store requirement)

---

## Out of Scope

- Offline mode / service worker caching of full app
- DCA execution status in popup (deferred)
- DCA failed / low balance notifications (deferred)
- Reusing push-redis infrastructure (overkill for v1)
