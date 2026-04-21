# StacksPort - DCA & Portfolio Platform for Stacks

A non-custodial DCA (Dollar-Cost Averaging) and portfolio management platform built on the Stacks blockchain. Users can automate recurring STX-to-sBTC and sBTC-to-USDCx swaps via Bitflow DEX, track holdings, monitor markets, and set price alerts.

## Architecture

```
stacks-portfolio/
├── src/                    # Next.js 15 frontend
│   ├── app/                # Pages & API routes
│   │   ├── dashboard/      # Portfolio overview, market stats, news
│   │   ├── trade/          # Swap widget & aeUSDC migration
│   │   ├── dca/            # DCA vault management
│   │   ├── assets/         # Holdings, PnL, stacking tracker
│   │   ├── notifications/  # Alerts & notification history
│   │   └── api/            # Backend proxies (Bitflow, CoinGecko, news, push)
│   ├── components/         # React components
│   ├── hooks/              # usePushNotifications, usePriceAlertPolling, etc.
│   ├── lib/                # Blockchain utils, Bitflow SDK, DCA helpers, push-storage
│   ├── store/              # Zustand stores (wallet, notifications, price alerts)
│   └── types/              # TypeScript type definitions
├── contracts/              # Clarity smart contracts
│   ├── dca-vault.clar      # DCA vault for STX → sBTC
│   ├── dca-vault-sbtc.clar # DCA vault for sBTC → USDCx
│   ├── bitflow-sbtc-swap-router.clar  # STX → sBTC swap via Bitflow xyk pool
│   └── bitflow-usdcx-swap-router.clar # sBTC → USDCx 3-hop swap router
├── keeper-bot/             # Automated DCA executor + push notification daemon
│   └── src/
│       ├── index.ts        # DCA batch executor (one-shot, runs via cron)
│       ├── price-push.ts   # Price check & Web Push loop
│       └── push-worker.ts  # Push daemon entry point (long-running)
├── public/
│   └── sw.js              # Service Worker (receives push, shows notification)
├── data/                   # Runtime storage (gitignored)
│   └── push-subscriptions.json  # Push subscription store (wallet → sub + alerts)
└── .github/workflows/      # GitHub Actions (2 keeper-bot crons every 10min)
```

## Features

- **DCA Vault (STX → sBTC)** - Create automated recurring buy plans with configurable intervals and amounts. Pause, resume, or cancel anytime with refund.
- **DCA Vault (sBTC → USDCx)** - Automate sBTC-to-USDCx swaps via 3-hop route (sBTC → STX → aeUSDC → USDCx). Same pause/resume/cancel features.
- **Swap** - Instant token swaps via Bitflow DEX with real-time quotes.
- **Portfolio Tracker** - Real-time balances, PnL tracking, portfolio health score, stacking & sBTC monitoring.
- **Price Alerts** - Set target prices and receive native push notifications (via Web Push API) even when the browser tab is closed or the app is in the background.
- **Market Intelligence** - Fear & Greed Index, trending tokens, live crypto news, STX market stats.
- **Keeper Bot** - Serverless bot (GitHub Actions) that automatically executes DCA plans when they're due.
- **Push Worker** - Long-running daemon that polls CoinGecko every 10 seconds and sends Web Push notifications when price alerts trigger.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| State | Zustand |
| Charts | Recharts |
| Blockchain | Stacks Connect, @stacks/transactions |
| DEX | Bitflow SDK |
| Smart Contracts | Clarity 3 (Stacks) |
| Keeper Bot | Node.js, @stacks/wallet-sdk |
| Push Notifications | Web Push API, VAPID, `web-push` npm package |
| Deployment | Vercel (frontend), GitHub Actions (keeper bot) |

## Smart Contracts

Deployed on **Stacks Mainnet** at `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV`:

| Contract | Description |
|----------|-------------|
| `dca-vault` | DCA vault for STX → sBTC plans, deposits, execution, fees (0.3%) |
| `dca-vault-sbtc-v2` | DCA vault for sBTC → USDCx plans, deposits, execution, fees (0.3%) |
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
cp .env.example .env   # Fill in KEEPER_PRIVATE_KEY, KEEPER_ADDRESS, and VAPID vars
npm install
npm run dev
```

`KEEPER_PRIVATE_KEY` accepts either a 64-char hex private key or a 24-word mnemonic seed phrase.

### Push Worker (price alert daemon)

```bash
cd keeper-bot
npm run push
```

The push worker polls CoinGecko every 10 seconds and sends Web Push notifications when a price alert triggers. Run this as a long-running process alongside (or separately from) the keeper bot. Subscriptions inactive for more than 8 hours are automatically evicted.

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
| `BITFLOW_API_KEY` | Bitflow DEX API key |
| `VAPID_PUBLIC_KEY` | VAPID public key (shared with browser for push subscription) |

### Keeper Bot

| Variable | Required | Description |
|----------|----------|-------------|
| `KEEPER_PRIVATE_KEY` | Yes | Hex key or 24-word mnemonic |
| `KEEPER_ADDRESS` | Yes | Keeper wallet STX address |
| `CONTRACT_ADDRESS` | No | DCA vault address (default: mainnet) |
| `CONTRACT_NAME` | No | Contract name (default: dca-vault-sbtc-v2) |
| `SWAP_ROUTER` | No | Swap router contract (default: bitflow-usdcx-swap-router) |
| `HIRO_API_URL` | No | Stacks API (default: https://api.hiro.so) |
| `MIN_AMOUNT_OUT` | No | Min output for slippage (default: 1) |
| `VAPID_PUBLIC_KEY` | Yes (push) | VAPID public key (same as frontend) |
| `VAPID_PRIVATE_KEY` | Yes (push) | VAPID private key |
| `VAPID_SUBJECT` | Yes (push) | Contact URI, e.g. `mailto:you@example.com` |
| `PUSH_CHECK_INTERVAL_MS` | No | Price check interval for push worker (default: 10000) |

Generate VAPID keys:
```bash
cd keeper-bot && node -e "const wp = await import('web-push'); const k = wp.generateVAPIDKeys(); console.log(k);"
```

## Deployment

- **Frontend**: Push to `main` → auto-deploys on Vercel
- **Keeper Bot**: Two GitHub Actions workflows run via cron (`*/10 * * * *`), one per DCA vault. Requires `KEEPER_PRIVATE_KEY` and `KEEPER_ADDRESS` as repository secrets.

## License

MIT
