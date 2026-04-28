# StacksPort - DCA & Portfolio Platform for Stacks

A non-custodial DCA (Dollar-Cost Averaging) and portfolio management platform built on the Stacks blockchain. Users can automate recurring STX-to-sBTC and sBTC-to-USDCx swaps via Bitflow DEX, track holdings, monitor markets, and set price alerts.

## Architecture

```
StacksPort/
├── src/                    # Next.js 15 frontend
│   ├── app/                # Pages & API routes
│   │   ├── dashboard/      # Portfolio overview, market stats, news
│   │   ├── trade/          # Swap widget & aeUSDC migration
│   │   ├── dca/            # DCA vault management
│   │   ├── assets/         # Holdings, PnL, stacking tracker
│   │   ├── notifications/  # Alerts & notification history
│   │   ├── ai/             # Stacks AI insights (Groq-powered)
│   │   └── api/            # Backend proxies (Bitflow, CoinGecko, news, push)
│   ├── components/         # React components
│   ├── hooks/              # usePushNotifications, usePriceAlertPolling, etc.
│   ├── lib/                # Blockchain utils, Bitflow SDK, DCA helpers
│   ├── store/              # Zustand stores (wallet, notifications, price alerts)
│   └── types/              # TypeScript type definitions
├── contracts/              # Clarity smart contracts
│   ├── dca-vault.clar      # DCA vault for STX → sBTC
│   ├── dca-vault-sbtc.clar # DCA vault for sBTC → USDCx
│   ├── bitflow-sbtc-swap-router.clar  # STX → sBTC swap via Bitflow xyk pool
│   └── bitflow-usdcx-swap-router.clar # sBTC → USDCx 3-hop swap router
├── keeper-bot/             # Automated DCA executor + push notification worker
│   └── src/
│       ├── index.ts        # DCA batch executor entry point
│       ├── batch-executor.ts # Batch execution logic
│       ├── push-once.ts    # One-shot price-check & push (runs via cron)
│       ├── push-worker.ts  # Long-running push daemon (local dev)
│       ├── price-push.ts   # Price check & Web Push logic
│       ├── redis-store.ts  # Upstash Redis wrapper for push subscriptions
│       ├── stacks-client.ts # Stacks API client
│       ├── config.ts       # Centralised env config
│       └── logger.ts       # Structured logger
├── public/
│   └── sw.js              # Service Worker (receives push, shows notification)
└── .github/workflows/      # GitHub Actions (keeper bot + push worker, every 15 min)
```

## Features

- **DCA Vault (STX → sBTC)** - Create automated recurring buy plans with configurable intervals and amounts. Pause, resume, or cancel anytime with refund.
- **DCA Vault (sBTC → USDCx)** - Automate sBTC-to-USDCx swaps via 3-hop route (sBTC → STX → aeUSDC → USDCx). Same pause/resume/cancel features.
- **Execution Watcher** - App-wide hook that polls for completed DCA executions and updates plan status in real time.
- **Swap** - Instant token swaps via Bitflow DEX with real-time quotes.
- **Portfolio Tracker** - Real-time balances, PnL tracking, portfolio health score, stacking & sBTC monitoring.
- **Price Alerts** - Set target prices and receive native push notifications (via Web Push API) even when the browser tab is closed or the app is in the background.
- **Market Intelligence** - Fear & Greed Index, trending tokens, live crypto news, STX market stats.
- **AI Insights** - Groq-powered Stacks market analysis.
- **Keeper Bot** - Serverless bot (GitHub Actions cron, every 15 min) that automatically executes DCA plans when they're due.
- **Push Worker** - Serverless one-shot job (GitHub Actions cron, every 15 min) that checks CoinGecko prices and sends Web Push notifications when price alerts trigger. Subscriptions are stored in Upstash Redis.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| State | Zustand |
| Charts | Recharts |
| Animations | GSAP, Framer Motion |
| Blockchain | Stacks Connect, @stacks/transactions |
| DEX | Bitflow SDK |
| Smart Contracts | Clarity 3 (Stacks) |
| AI | Groq API |
| Keeper Bot | Node.js, @stacks/wallet-sdk |
| Push Notifications | Web Push API, VAPID, `web-push` npm package |
| Push Storage | Upstash Redis |
| Deployment | Vercel (frontend), GitHub Actions (keeper bot + push worker) |

## Smart Contracts

Deployed on **Stacks Mainnet** at `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV`:

| Contract | Description |
|----------|-------------|
| `dca-vault` | DCA vault for STX → sBTC plans, deposits, execution, fees (0.3%) |
| `dca-vault-sbtc-v2` | DCA vault for sBTC → USDCx plans, deposits, execution, fees (0.3%) |
| `batch-dca-executor` | Batch executor that processes multiple DCA plans in one transaction |
| `bitflow-sbtc-swap-router` | Routes STX → sBTC swaps through Bitflow's xyk pool |
| `bitflow-usdcx-swap-router` | Routes sBTC → USDCx swaps via 3-hop (sBTC → STX → aeUSDC → USDCx) |

Key parameters:

| Parameter | dca-vault (STX) | dca-vault-sbtc-v2 (sBTC) |
|-----------|----------------|--------------------------|
| Min swap amount | 1 STX | 334 satoshis |
| Min initial deposit | 2 STX | 668 satoshis |
| Max plans per user | 10 | 10 |
| Protocol fee | 0.3% per swap | 0.3% per swap |

## Getting Started

### Prerequisites

- Node.js 20+
- A Stacks wallet (Leather or Xverse)

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Keeper Bot (DCA executor)

```bash
cd keeper-bot
cp .env.example .env   # Fill in KEEPER_PRIVATE_KEY, KEEPER_ADDRESS, and other vars
npm install
npm run dev
```

`KEEPER_PRIVATE_KEY` accepts either a 64-char hex private key or a 24-word mnemonic seed phrase.

### Push Worker (local dev — price alert daemon)

```bash
cd keeper-bot
npm run push
```

In production the push worker runs as a one-shot GitHub Actions cron job (`push:once`) every 15 minutes instead of a long-running process.

### Smart Contracts

Requires [Clarinet](https://github.com/hirosystems/clarinet):

```bash
cd contracts
clarinet check
clarinet test
```

## Environment Variables

### Frontend (`.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed contract address |
| `BITFLOW_API_KEY` | Bitflow DEX API key (optional) |
| `GROQ_API_KEY` | Groq API key for AI insights |
| `VAPID_PUBLIC_KEY` | VAPID public key (shared with browser for push subscription) |

### Keeper Bot (`keeper-bot/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `KEEPER_PRIVATE_KEY` | Yes | Hex key or 24-word mnemonic |
| `KEEPER_ADDRESS` | Yes | Keeper wallet STX address |
| `BATCH_EXECUTOR_CONTRACT` | No | Batch executor contract (default: mainnet) |
| `STX_VAULT_CONTRACT` | No | STX DCA vault contract (default: mainnet) |
| `SBTC_VAULT_CONTRACT` | No | sBTC DCA vault contract (default: mainnet) |
| `HIRO_API_URL` | No | Stacks API (default: https://api.hiro.so) |
| `MIN_AMOUNT_OUT` | No | Min output for slippage (default: 1) |
| `VAPID_PUBLIC_KEY` | Yes (push) | VAPID public key (same as frontend) |
| `VAPID_PRIVATE_KEY` | Yes (push) | VAPID private key |
| `VAPID_SUBJECT` | Yes (push) | Contact URI, e.g. `mailto:you@example.com` |
| `UPSTASH_REDIS_REST_URL` | Yes (push) | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (push) | Upstash Redis REST token |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for failure alerts |
| `TELEGRAM_CHAT_ID` | No | Telegram chat ID for failure alerts |

Generate VAPID keys:
```bash
cd keeper-bot && node -e "const wp = await import('web-push'); const k = wp.generateVAPIDKeys(); console.log(k);"
```

## Deployment

- **Frontend**: Push to `main` → auto-deploys on Vercel.
- **Keeper Bot**: GitHub Actions cron (`*/15 * * * *`) runs the batch DCA executor. Requires `KEEPER_PRIVATE_KEY` and `KEEPER_ADDRESS` as repository secrets.
- **Push Worker**: GitHub Actions cron (`*/15 * * * *`) runs the one-shot push job. Requires VAPID secrets and Upstash Redis credentials as repository secrets. Sends a Telegram alert on failure if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set.

## License

MIT
