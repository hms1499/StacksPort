# Chrome Side Panel Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chrome Extension to StacksPort that embeds the full app in a Side Panel and provides a quick-stats popup with live prices, portfolio value, and notifications.

**Architecture:** A standalone `extension/` directory (MV3) wraps the deployed Vercel app in a Side Panel iframe. A background service worker polls prices every 5 minutes and fires native notifications on price alerts and >5% swings. A content script syncs wallet address and notifications from localStorage to `chrome.storage`. Only 3 files in the web app need changes.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS (no build step), Next.js API route (TypeScript), `sips` (macOS, for icon generation).

---

## File Map

### New — extension/
| File | Responsibility |
|---|---|
| `extension/manifest.json` | MV3 manifest: permissions, icons, content script, side panel |
| `extension/background.js` | Service worker: alarms, price polling, notifications, storage sync |
| `extension/content_script.js` | Injected into Vercel app: reads localStorage, sends to background |
| `extension/popup.html` | Toolbar popup shell (360×480px) |
| `extension/popup.css` | Dark theme styles matching brand green `#408A71` |
| `extension/popup.js` | Popup logic: read storage, fetch summary, render UI |
| `extension/side_panel.html` | Side panel shell with full-height iframe |
| `extension/side_panel.js` | Reads app URL from storage, sets iframe src |
| `extension/options.html` | Options page shell |
| `extension/options.js` | Save/load app URL from `chrome.storage.sync` |
| `extension/generate-icons.sh` | Uses macOS `sips` to resize `public/logo.png` to 16/32/48/128px |
| `extension/icons/*.png` | Generated PNG icons |

### Modified — web app
| File | Change |
|---|---|
| `next.config.ts` | Add `headers()`: CSP `frame-ancestors` + CORS for extension |
| `src/app/api/coingecko/[...path]/route.ts` | Add `Access-Control-Allow-Origin: *` to response |
| `src/app/api/extension/summary/route.ts` | **New**: prices + portfolio endpoint for popup/background |

---

## Task 1: Web App — CSP + CORS Headers in next.config.ts

**Files:**
- Modify: `next.config.ts`

Enables the Side Panel iframe to load the app, and allows the extension to call API routes.

- [ ] **Step 1: Add headers() config to next.config.ts**

Replace the existing config with:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@stacks/transactions",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        // Allow Chrome extension to embed the app in Side Panel
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' chrome-extension://*",
          },
        ],
      },
      {
        // Allow extension background service worker to call API routes
        source: "/api/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@stacks/connect-ui": "@stacks/connect-ui",
      };

      config.module.rules.push({
        test: /\.js$/,
        include: /node_modules\/@stacks\/connect-ui/,
        type: "javascript/esm",
      });
    }

    return config;
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(extension): add CSP frame-ancestors and CORS headers for Chrome extension"
```

---

## Task 2: Web App — /api/extension/summary Route

**Files:**
- Create: `src/app/api/extension/summary/route.ts`

Returns STX/BTC prices and portfolio total USD. Called by popup.js and background.js.

Note: `getSTXPrice()` in `src/lib/stacks.ts` uses relative URL `/api/coingecko` which only works client-side. This route fetches CoinGecko and Hiro directly with absolute URLs.

- [ ] **Step 1: Create the route file**

```ts
// src/app/api/extension/summary/route.ts
import { NextRequest, NextResponse } from "next/server";

const COINGECKO = "https://api.coingecko.com/api/v3";
const HIRO = "https://api.hiro.so";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  try {
    // Prices: STX + BTC in one call
    const priceRes = await fetch(
      `${COINGECKO}/simple/price?ids=blockstack,bitcoin&vs_currencies=usd&include_24hr_change=true`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(10_000) }
    );
    const priceData = priceRes.ok ? await priceRes.json() : {};

    const prices = {
      stx: priceData?.blockstack?.usd ?? 0,
      btc: priceData?.bitcoin?.usd ?? 0,
      stxChange24h: priceData?.blockstack?.usd_24h_change ?? 0,
      btcChange24h: priceData?.bitcoin?.usd_24h_change ?? 0,
    };

    // Portfolio: only if address provided
    let portfolio = { totalUSD: 0, stxBalance: 0 };
    if (address) {
      const balRes = await fetch(
        `${HIRO}/extended/v1/address/${address}/balances`,
        { next: { revalidate: 30 }, signal: AbortSignal.timeout(10_000) }
      );
      if (balRes.ok) {
        const balData = await balRes.json();
        const stxMicro = Number(balData?.stx?.balance ?? 0);
        const stxBalance = stxMicro / 1_000_000;
        portfolio = {
          totalUSD: stxBalance * prices.stx,
          stxBalance,
        };
      }
    }

    return NextResponse.json({ prices, portfolio }, { headers: CORS });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500, headers: CORS }
    );
  }
}
```

- [ ] **Step 2: Test the route locally**

Start dev server, then in a separate terminal:

```bash
curl "http://localhost:3000/api/extension/summary" | jq .
```

Expected output (prices may vary):
```json
{
  "prices": { "stx": 1.24, "btc": 98430, "stxChange24h": 3.2, "btcChange24h": 0.8 },
  "portfolio": { "totalUSD": 0, "stxBalance": 0 }
}
```

- [ ] **Step 3: Test with a wallet address**

```bash
curl "http://localhost:3000/api/extension/summary?address=SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV" | jq .portfolio
```

Expected: `totalUSD` is a number > 0, `stxBalance` > 0.

- [ ] **Step 4: Verify CORS header is present**

```bash
curl -I "http://localhost:3000/api/extension/summary" | grep -i "access-control"
```

Expected: `access-control-allow-origin: *`

- [ ] **Step 5: Kill dev server, commit**

```bash
kill $(lsof -t -i:3000) 2>/dev/null || true
git add src/app/api/extension/summary/route.ts
git commit -m "feat(extension): add /api/extension/summary endpoint"
```

---

## Task 3: Extension — Scaffold (manifest.json + icons)

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/generate-icons.sh`
- Create: `extension/icons/` (generated)

- [ ] **Step 1: Create extension/ directory and generate-icons.sh**

```bash
mkdir -p extension/icons
```

Create `extension/generate-icons.sh`:

```bash
#!/bin/bash
# Generates extension icons from public/logo.png using macOS sips
# Run from the repo root: bash extension/generate-icons.sh
set -e
for size in 16 32 48 128; do
  sips -z $size $size public/logo.png --out "extension/icons/${size}.png" > /dev/null
  echo "Generated extension/icons/${size}.png"
done
```

- [ ] **Step 2: Generate icons**

```bash
bash extension/generate-icons.sh
```

Expected:
```
Generated extension/icons/16.png
Generated extension/icons/32.png
Generated extension/icons/48.png
Generated extension/icons/128.png
```

Verify:
```bash
ls -la extension/icons/
```

- [ ] **Step 3: Create manifest.json**

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "StacksPort",
  "version": "1.0.0",
  "description": "DCA & portfolio management on Stacks blockchain",
  "icons": {
    "16": "icons/16.png",
    "32": "icons/32.png",
    "48": "icons/48.png",
    "128": "icons/128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/16.png",
      "32": "icons/32.png",
      "48": "icons/48.png",
      "128": "icons/128.png"
    },
    "default_title": "StacksPort"
  },
  "side_panel": {
    "default_path": "side_panel.html"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://stack-sport.vercel.app/*"],
      "js": ["content_script.js"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "permissions": ["sidePanel", "notifications", "alarms", "storage", "tabs"],
  "host_permissions": ["https://stack-sport.vercel.app/*"],
  "options_page": "options.html"
}
```

- [ ] **Step 4: Load extension in Chrome and verify icon appears**

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked" → select the `extension/` directory
4. Verify: StacksPort icon appears in Chrome toolbar

- [ ] **Step 5: Commit**

```bash
git add extension/manifest.json extension/generate-icons.sh extension/icons/
git commit -m "feat(extension): add manifest.json and icons"
```

---

## Task 4: Extension — content_script.js

**Files:**
- Create: `extension/content_script.js`

Injected into `stack-sport.vercel.app`. Reads wallet, notifications, and price alerts from localStorage (zustand persist keys), sends to background service worker.

Zustand persist keys (verified from source):
- Wallet: `'stacks-wallet'` → `state.stxAddress`
- Notifications: `'notifications-storage'` → `state.notifications[]`
- Price alerts: `'price-alerts-storage'` → `state.alerts[]`

- [ ] **Step 1: Create content_script.js**

```js
// extension/content_script.js
const WALLET_KEY = 'stacks-wallet';
const NOTIFS_KEY = 'notifications-storage';
const ALERTS_KEY = 'price-alerts-storage';

function syncData() {
  try {
    const walletRaw = localStorage.getItem(WALLET_KEY);
    const notifsRaw = localStorage.getItem(NOTIFS_KEY);
    const alertsRaw = localStorage.getItem(ALERTS_KEY);

    const wallet = walletRaw ? JSON.parse(walletRaw) : null;
    const notifs = notifsRaw ? JSON.parse(notifsRaw) : null;
    const alerts = alertsRaw ? JSON.parse(alertsRaw) : null;

    const stxAddress = wallet?.state?.stxAddress ?? null;
    const notifications = (notifs?.state?.notifications ?? [])
      .slice(0, 3)
      .map(({ id, message, type, category, timestamp, isRead }) => ({
        id, message, type, category, timestamp, isRead,
      }));
    const priceAlerts = (alerts?.state?.alerts ?? [])
      .filter((a) => a.isActive)
      .map(({ id, tokenSymbol, geckoId, condition, targetPrice }) => ({
        id, tokenSymbol, geckoId, condition, targetPrice,
      }));

    chrome.runtime.sendMessage({
      type: 'SYNC_DATA',
      stxAddress,
      notifications,
      priceAlerts,
    });
  } catch {
    // Best-effort — never throw from content script
  }
}

// Sync on page load
syncData();

// Re-sync when localStorage changes (wallet connect/disconnect in another tab or frame)
window.addEventListener('storage', (e) => {
  if ([WALLET_KEY, NOTIFS_KEY, ALERTS_KEY].includes(e.key)) {
    syncData();
  }
});
```

- [ ] **Step 2: Reload extension, open app in a tab, verify message sent**

1. Reload extension at `chrome://extensions`
2. Open `https://stack-sport.vercel.app` in a tab
3. Open DevTools → Application → Storage → Local Storage → verify keys exist
4. Open background service worker DevTools (via `chrome://extensions` → "Service Worker" link)
5. In background Console, run:
   ```js
   chrome.storage.local.get(null, console.log)
   ```
   Expected: `{ notifications: [...], priceAlerts: [...] }` (may be empty if wallet not connected)

- [ ] **Step 3: Connect wallet in the app, verify stxAddress synced**

1. Connect wallet in the app
2. In background service worker Console:
   ```js
   chrome.storage.sync.get('stxAddress', console.log)
   ```
   Expected: `{ stxAddress: "SP2..." }`

- [ ] **Step 4: Commit**

```bash
git add extension/content_script.js
git commit -m "feat(extension): add content script to sync wallet and alerts from localStorage"
```

---

## Task 5: Extension — background.js

**Files:**
- Create: `extension/background.js`

Service worker handles: SYNC_DATA messages from content script, two alarms (price polling + alert checking), and native Chrome notifications.

- [ ] **Step 1: Create background.js**

```js
// extension/background.js
const DEFAULT_APP_URL = 'https://stack-sport.vercel.app';

// ─── Setup on install ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('pollPrice', { periodInMinutes: 5 });
  chrome.alarms.create('checkAlerts', { periodInMinutes: 5 });
});

// ─── Message handler (content script → background) ────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'SYNC_DATA') return;
  if (msg.stxAddress) {
    chrome.storage.sync.set({ stxAddress: msg.stxAddress });
  }
  chrome.storage.local.set({
    notifications: msg.notifications ?? [],
    priceAlerts: msg.priceAlerts ?? [],
  });
});

// ─── Alarms ───────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollPrice') pollPrice();
  if (alarm.name === 'checkAlerts') checkAlerts();
});

// ─── Price polling — notify on >5% swing (requires 2 consecutive confirmations) ──

async function pollPrice() {
  try {
    const appUrl = await getAppUrl();
    const res = await fetch(
      `${appUrl}/api/coingecko/simple/price?ids=blockstack,bitcoin&vs_currencies=usd&include_24hr_change=true`
    );
    if (!res.ok) return;
    const data = await res.json();

    const stxPrice = data?.blockstack?.usd;
    if (!stxPrice) return;

    const { prevStxPrice, confirmCount = 0 } = await chrome.storage.local.get([
      'prevStxPrice',
      'confirmCount',
    ]);

    if (prevStxPrice) {
      const changePct = Math.abs((stxPrice - prevStxPrice) / prevStxPrice);
      if (changePct > 0.05) {
        if (confirmCount + 1 >= 2) {
          const direction = stxPrice > prevStxPrice ? 'up' : 'down';
          chrome.notifications.create(`price-swing-${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icons/48.png',
            title: 'STX Price Movement',
            message: `STX is ${direction} ${(changePct * 100).toFixed(1)}% to $${stxPrice.toFixed(3)}`,
          });
          await chrome.storage.local.set({ confirmCount: 0 });
        } else {
          await chrome.storage.local.set({ confirmCount: confirmCount + 1 });
        }
      } else {
        await chrome.storage.local.set({ confirmCount: 0 });
      }
    }

    await chrome.storage.local.set({ prevStxPrice: stxPrice, lastPollAt: Date.now() });
  } catch {
    // Network error — retry next alarm cycle
  }
}

// ─── Alert checking — fire once per alert trigger ────────────────────────────

async function checkAlerts() {
  try {
    const { stxAddress } = await chrome.storage.sync.get('stxAddress');
    if (!stxAddress) return;

    const appUrl = await getAppUrl();
    const res = await fetch(`${appUrl}/api/extension/summary?address=${stxAddress}`);
    if (!res.ok) return;
    const { prices, priceAlerts: freshAlerts } = await res.json();

    const { priceAlerts = [], firedAlertIds = [] } = await chrome.storage.local.get([
      'priceAlerts',
      'firedAlertIds',
    ]);

    // Use alerts from chrome.storage (synced by content script) — freshAlerts not used here
    const newlyFired = [];
    for (const alert of priceAlerts) {
      if (firedAlertIds.includes(alert.id)) continue;

      const currentPrice =
        alert.tokenSymbol === 'STX' ? prices?.stx :
        alert.tokenSymbol === 'BTC' ? prices?.btc :
        null;

      if (currentPrice === null) continue;

      const triggered =
        (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && currentPrice <= alert.targetPrice);

      if (triggered) {
        chrome.notifications.create(`alert-${alert.id}`, {
          type: 'basic',
          iconUrl: 'icons/48.png',
          title: `${alert.tokenSymbol} Price Alert`,
          message: `${alert.tokenSymbol} is ${alert.condition} $${alert.targetPrice.toLocaleString()} (now $${currentPrice.toLocaleString()})`,
        });
        newlyFired.push(alert.id);
      }
    }

    if (newlyFired.length) {
      await chrome.storage.local.set({ firedAlertIds: [...firedAlertIds, ...newlyFired] });
    }
  } catch {
    // Network error — retry next alarm cycle
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAppUrl() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  return appUrl || DEFAULT_APP_URL;
}
```

- [ ] **Step 2: Reload extension, verify alarms registered**

1. Reload extension at `chrome://extensions`
2. Click "Service Worker" to open background DevTools
3. In Console, run:
   ```js
   chrome.alarms.getAll(console.log)
   ```
   Expected: array with `pollPrice` and `checkAlerts` alarms, each with `periodInMinutes: 5`

- [ ] **Step 3: Manually trigger pollPrice to verify it runs without errors**

In background Console:
```js
chrome.alarms.create('pollPriceTest', { delayInMinutes: 0.01 })
// Wait 1 second, then:
chrome.storage.local.get(['prevStxPrice', 'lastPollAt'], console.log)
```
Expected: `prevStxPrice` is a number, `lastPollAt` is a recent timestamp.

- [ ] **Step 4: Commit**

```bash
git add extension/background.js
git commit -m "feat(extension): add background service worker with price polling and alert notifications"
```

---

## Task 6: Extension — side_panel.html + side_panel.js

**Files:**
- Create: `extension/side_panel.html`
- Create: `extension/side_panel.js`

Full-height iframe embedding the Vercel app. App URL is read from `chrome.storage.sync.appUrl` (configurable via options page), falling back to the hardcoded Vercel URL.

- [ ] **Step 1: Create side_panel.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0f1117; }
    #app-frame { width: 100%; height: 100%; border: none; }
    #loading {
      position: fixed; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #0f1117; color: #408A71; font-family: system-ui; gap: 12px;
    }
    #loading svg { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loading">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    <span style="font-size:13px;color:#6b7280;">Loading StacksPort...</span>
  </div>
  <iframe id="app-frame" allow="clipboard-write; clipboard-read"></iframe>
  <script src="side_panel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create side_panel.js**

```js
// extension/side_panel.js
const DEFAULT_URL = 'https://stack-sport.vercel.app';

async function init() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  const frame = document.getElementById('app-frame');
  const loading = document.getElementById('loading');

  frame.addEventListener('load', () => {
    loading.style.display = 'none';
    frame.style.display = 'block';
  });

  frame.src = appUrl || DEFAULT_URL;
}

init();
```

- [ ] **Step 3: Reload extension and test side panel**

1. Reload extension at `chrome://extensions`
2. Right-click the StacksPort icon in toolbar → "Open side panel"
   (or navigate to any page, then open side panel)
3. Expected: loading spinner → app loads in full height

- [ ] **Step 4: Commit**

```bash
git add extension/side_panel.html extension/side_panel.js
git commit -m "feat(extension): add side panel with iframe app embed"
```

---

## Task 7: Extension — popup.html + popup.css + popup.js

**Files:**
- Create: `extension/popup.html`
- Create: `extension/popup.css`
- Create: `extension/popup.js`

Quick-stats popup (360×480px): live prices, portfolio total, recent notifications. "Open App →" button opens the Side Panel.

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StacksPort</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <!-- Header -->
    <header>
      <div class="brand">
        <div class="brand-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <span class="brand-name">StacksPort</span>
      </div>
      <button id="open-app">Open App →</button>
    </header>

    <!-- Prices -->
    <section class="section">
      <div class="label">Live Prices</div>
      <div class="price-grid">
        <div class="price-card">
          <div class="token">STX</div>
          <div class="value" id="stx-price">—</div>
          <div class="change" id="stx-change">—</div>
        </div>
        <div class="price-card">
          <div class="token">sBTC</div>
          <div class="value" id="sbtc-price">—</div>
          <div class="change" id="sbtc-change">—</div>
        </div>
        <div class="price-card">
          <div class="token">BTC</div>
          <div class="value" id="btc-price">—</div>
          <div class="change" id="btc-change">—</div>
        </div>
      </div>
    </section>

    <!-- Portfolio -->
    <section class="section">
      <div class="label">Portfolio</div>
      <div id="portfolio-connected">
        <div class="portfolio-total" id="portfolio-total">—</div>
        <div class="portfolio-change" id="portfolio-change"></div>
      </div>
      <div id="portfolio-disconnected" style="display:none">
        <p class="wallet-prompt">Connect wallet in app to see portfolio</p>
      </div>
    </section>

    <!-- Notifications -->
    <section class="section">
      <div class="label">Recent</div>
      <ul id="notif-list">
        <li class="notif-empty">No notifications yet</li>
      </ul>
    </section>

    <!-- Footer -->
    <footer>
      <span id="wallet-addr">—</span>
      <span id="updated-at">—</span>
    </footer>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.css**

```css
/* extension/popup.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 360px;
  min-height: 480px;
  background: #0f1117;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
}

#app { display: flex; flex-direction: column; min-height: 480px; }

/* Header */
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #111827;
  border-bottom: 1px solid #1f2937;
}

.brand { display: flex; align-items: center; gap: 8px; }

.brand-icon {
  width: 24px; height: 24px;
  background: #408A71;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.brand-name { font-weight: 600; font-size: 14px; color: #f1f5f9; }

#open-app {
  background: #408A71;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
#open-app:hover { background: #4ea885; }

/* Sections */
.section {
  padding: 12px 14px;
  border-bottom: 1px solid #1f2937;
}

.label {
  color: #6b7280;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 8px;
}

/* Price grid */
.price-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.price-card {
  background: #111827;
  border-radius: 8px;
  padding: 8px 10px;
}

.token { color: #9ca3af; font-size: 10px; margin-bottom: 3px; }
.value { color: #f1f5f9; font-size: 14px; font-weight: 700; }
.change { font-size: 10px; margin-top: 2px; }
.change.positive { color: #34d399; }
.change.negative { color: #f87171; }
.change.neutral { color: #6b7280; }

/* Portfolio */
.portfolio-total { font-size: 22px; font-weight: 700; color: #f1f5f9; }
.portfolio-change { font-size: 12px; margin-top: 2px; }
.portfolio-change.positive { color: #34d399; }
.portfolio-change.negative { color: #f87171; }
.wallet-prompt { color: #6b7280; font-size: 12px; padding: 4px 0; }

/* Notifications */
#notif-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }

.notif-empty { color: #4b5563; font-size: 12px; }

.notif-item { display: flex; align-items: flex-start; gap: 8px; }

.dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #408A71;
  margin-top: 4px;
  flex-shrink: 0;
}
.dot.read { background: #374151; }

.notif-msg { color: #d1d5db; font-size: 12px; line-height: 1.4; }
.notif-time { color: #4b5563; font-size: 10px; margin-top: 2px; }

/* Footer */
footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  background: #111827;
  border-top: 1px solid #1f2937;
  margin-top: auto;
}
footer span { color: #4b5563; font-size: 10px; }
```

- [ ] **Step 3: Create popup.js**

```js
// extension/popup.js
const DEFAULT_URL = 'https://stack-sport.vercel.app';

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUsd(v) {
  if (v == null) return '—';
  if (v >= 10_000) return '$' + Math.round(v).toLocaleString('en-US');
  if (v >= 1) return '$' + v.toFixed(2);
  return '$' + v.toFixed(4);
}

function fmtPct(pct) {
  if (pct == null) return { text: '—', cls: 'neutral' };
  const sign = pct >= 0 ? '▲' : '▼';
  return {
    text: `${sign} ${Math.abs(pct).toFixed(1)}%`,
    cls: pct >= 0 ? 'positive' : 'negative',
  };
}

function fmtAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function renderPrices(prices) {
  if (!prices) return;
  document.getElementById('stx-price').textContent = fmtUsd(prices.stx);
  document.getElementById('sbtc-price').textContent = fmtUsd(prices.btc);
  document.getElementById('btc-price').textContent = fmtUsd(prices.btc);

  const stxChg = fmtPct(prices.stxChange24h);
  const stxEl = document.getElementById('stx-change');
  stxEl.textContent = stxChg.text;
  stxEl.className = `change ${stxChg.cls}`;

  const btcChg = fmtPct(prices.btcChange24h);
  ['sbtc-change', 'btc-change'].forEach((id) => {
    const el = document.getElementById(id);
    el.textContent = btcChg.text;
    el.className = `change ${btcChg.cls}`;
  });
}

function renderPortfolio(portfolio, stxAddress) {
  const connected = document.getElementById('portfolio-connected');
  const disconnected = document.getElementById('portfolio-disconnected');

  if (!stxAddress) {
    connected.style.display = 'none';
    disconnected.style.display = 'block';
    return;
  }

  connected.style.display = 'block';
  disconnected.style.display = 'none';

  if (!portfolio) return;
  document.getElementById('portfolio-total').textContent = fmtUsd(portfolio.totalUSD);
}

function renderNotifications(notifs) {
  const list = document.getElementById('notif-list');
  if (!notifs || !notifs.length) {
    list.innerHTML = '<li class="notif-empty">No notifications yet</li>';
    return;
  }
  list.innerHTML = notifs
    .slice(0, 3)
    .map(
      (n) => `<li class="notif-item">
        <span class="dot ${n.isRead ? 'read' : ''}"></span>
        <div>
          <div class="notif-msg">${escHtml(n.message ?? '')}</div>
          <div class="notif-time">${timeAgo(n.timestamp ?? 0)}</div>
        </div>
      </li>`
    )
    .join('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function getAppUrl() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  return appUrl || DEFAULT_URL;
}

async function loadCachedData() {
  const { cachedPrices, cachedPortfolio, notifications, lastFetchAt } =
    await chrome.storage.local.get([
      'cachedPrices', 'cachedPortfolio', 'notifications', 'lastFetchAt',
    ]);
  // stxAddress lives in sync storage (set by background.js from content_script message)
  const { stxAddress } = await chrome.storage.sync.get('stxAddress');

  renderPrices(cachedPrices);
  renderPortfolio(cachedPortfolio, stxAddress);
  renderNotifications(notifications);

  document.getElementById('wallet-addr').textContent = fmtAddr(stxAddress);
  if (lastFetchAt) {
    document.getElementById('updated-at').textContent = timeAgo(lastFetchAt);
  }
}

async function fetchFreshData() {
  try {
    const appUrl = await getAppUrl();
    const { stxAddress } = await chrome.storage.sync.get('stxAddress');
    const qs = stxAddress ? `?address=${stxAddress}` : '';

    const res = await fetch(`${appUrl}/api/extension/summary${qs}`);
    if (!res.ok) return;
    const data = await res.json();

    await chrome.storage.local.set({
      cachedPrices: data.prices,
      cachedPortfolio: data.portfolio,
      lastFetchAt: Date.now(),
    });

    renderPrices(data.prices);
    renderPortfolio(data.portfolio, stxAddress);
    document.getElementById('updated-at').textContent = 'Just now';
  } catch {
    const el = document.getElementById('updated-at');
    if (el.textContent && el.textContent !== '—') {
      el.textContent += ' (stale)';
    }
  }
}

async function init() {
  await loadCachedData();
  fetchFreshData(); // fire-and-forget — updates UI when resolved

  document.getElementById('open-app').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  });
}

init();
```

- [ ] **Step 4: Reload extension and test popup**

1. Reload extension at `chrome://extensions`
2. Click the StacksPort toolbar icon
3. Expected: popup opens at 360px wide with prices loading
4. Within 2-3 seconds, prices should fill in (STX, sBTC, BTC)
5. If wallet connected: portfolio total shows; otherwise "Connect wallet in app" message

- [ ] **Step 5: Verify "Open App →" button**

1. Click "Open App →" in popup
2. Expected: side panel opens with the full StacksPort app, popup closes

- [ ] **Step 6: Commit**

```bash
git add extension/popup.html extension/popup.css extension/popup.js
git commit -m "feat(extension): add popup with prices, portfolio, and notifications"
```

---

## Task 8: Extension — options.html + options.js

**Files:**
- Create: `extension/options.html`
- Create: `extension/options.js`

Allows switching between production URL and local dev URL. Useful for development and future Web Store distribution.

- [ ] **Step 1: Create options.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>StacksPort — Options</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117; color: #e2e8f0;
      max-width: 480px; margin: 40px auto; padding: 0 20px;
    }
    h1 { font-size: 18px; margin-bottom: 24px; color: #f1f5f9; }
    label { display: block; font-size: 13px; color: #9ca3af; margin-bottom: 6px; }
    input {
      width: 100%; padding: 10px 12px;
      background: #111827; border: 1px solid #374151;
      border-radius: 8px; color: #f1f5f9; font-size: 13px;
      outline: none;
    }
    input:focus { border-color: #408A71; }
    .row { display: flex; gap: 8px; margin-top: 8px; }
    button {
      padding: 8px 16px; border: none; border-radius: 6px;
      font-size: 13px; font-weight: 600; cursor: pointer;
    }
    #save-btn { background: #408A71; color: white; }
    #save-btn:hover { background: #4ea885; }
    #reset-btn { background: #1f2937; color: #9ca3af; }
    #reset-btn:hover { background: #374151; }
    #status { font-size: 12px; color: #408A71; margin-top: 8px; min-height: 18px; }
    .hint { font-size: 11px; color: #4b5563; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>StacksPort Settings</h1>
  <label for="app-url">App URL</label>
  <input type="url" id="app-url" placeholder="https://stack-sport.vercel.app">
  <p class="hint">Leave empty to use default: https://stack-sport.vercel.app</p>
  <div class="row">
    <button id="save-btn">Save</button>
    <button id="reset-btn">Reset to default</button>
  </div>
  <p id="status"></p>
  <script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create options.js**

```js
// extension/options.js
const DEFAULT_URL = 'https://stack-sport.vercel.app';

async function load() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  document.getElementById('app-url').value = appUrl || '';
}

document.getElementById('save-btn').addEventListener('click', async () => {
  const raw = document.getElementById('app-url').value.trim();
  const url = raw || DEFAULT_URL;

  // Basic validation
  try { new URL(url); } catch {
    document.getElementById('status').textContent = 'Invalid URL';
    return;
  }

  await chrome.storage.sync.set({ appUrl: raw || null });
  document.getElementById('status').textContent = 'Saved!';
  setTimeout(() => { document.getElementById('status').textContent = ''; }, 2000);
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  await chrome.storage.sync.remove('appUrl');
  document.getElementById('app-url').value = '';
  document.getElementById('status').textContent = 'Reset to default';
  setTimeout(() => { document.getElementById('status').textContent = ''; }, 2000);
});

load();
```

- [ ] **Step 3: Test options page**

1. Reload extension
2. Right-click StacksPort icon → "Options" (or go to `chrome://extensions` → Details → Extension options)
3. Enter `http://localhost:3000`, click Save
4. Open popup → prices should fail to load (localhost not running) — verify error handling shows "stale"
5. Open options → click Reset → popup works again with production URL

- [ ] **Step 4: Commit**

```bash
git add extension/options.html extension/options.js
git commit -m "feat(extension): add options page for app URL configuration"
```

---

## Task 9: End-to-End Manual Test Checklist

Full verification before considering the extension complete.

- [ ] **Reload extension one final time**

```
chrome://extensions → Reload StacksPort
```

- [ ] **Side panel test**
  1. Open any website (e.g. google.com)
  2. Click StacksPort icon → popup opens
  3. Click "Open App →" → side panel opens, full app loads in iframe
  4. Connect wallet in side panel → wallet connection works normally

- [ ] **Wallet sync test**
  1. After connecting wallet in side panel, close popup
  2. Reopen popup → portfolio section shows a USD value (not "Connect wallet" prompt)
  3. Footer shows truncated wallet address

- [ ] **Prices test**
  1. Open popup → STX, sBTC, BTC prices fill in within 3 seconds
  2. "Updated Xm ago" or "Just now" appears in footer

- [ ] **Notifications test**
  1. In the app (side panel), trigger any notification (e.g. set a price alert)
  2. Reload the Vercel app tab or wait for content script to re-sync
  3. Open popup → "Recent" section shows the notification

- [ ] **Price alert notification test**
  1. In background service worker Console, manually lower threshold:
     ```js
     // Override checkAlerts to use a 0% threshold temporarily
     // First, store a fake alert that should trigger
     chrome.storage.local.set({
       priceAlerts: [{ id: 'test-1', tokenSymbol: 'STX', condition: 'above', targetPrice: 0.01 }]
     });
     // Then trigger the alarm manually
     chrome.alarms.create('checkAlertsTest', { delayInMinutes: 0.01 });
     ```
  2. Wait 1 second → a Chrome notification should appear for STX price alert
  3. Clean up: `chrome.storage.local.remove('firedAlertIds')`

- [ ] **Offline / stale data test**
  1. Open popup while connected to internet — prices load
  2. Turn off wifi, reopen popup
  3. Expected: cached prices shown + "(stale)" appended to timestamp, no crash

- [ ] **Final commit**

```bash
git add .
git commit -m "feat(extension): complete Chrome Side Panel Extension v1.0"
```

---

## Known Limitations (v1)

- Portfolio only counts STX balance × STX price. Fungible tokens (ALEX, WELSH, etc.) not included — add by extending the summary route with the `geckoTokens` loop from `getPortfolioValue` in a future iteration.
- Price change notifications track only STX. BTC tracking can be added by extending `pollPrice`.
- `firedAlertIds` grows indefinitely — add a cleanup step (trim to last 100 IDs) in a future iteration.
