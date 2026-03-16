# StacksPort - DCA & Portfolio Platform for Stacks

A non-custodial DCA (Dollar-Cost Averaging) and portfolio management platform built on the Stacks blockchain. Users can automate recurring STX-to-sBTC swaps via Bitflow DEX, track holdings, monitor markets, and set price alerts.

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
│   │   └── api/            # Backend proxies (Bitflow, CoinGecko, news)
│   ├── components/         # 44 React components
│   ├── lib/                # Blockchain utils, Bitflow SDK, DCA helpers
│   ├── store/              # Zustand stores (wallet, notifications, alerts)
│   └── types/              # TypeScript type definitions
├── contracts/              # Clarity smart contracts
│   ├── dca-vault.clar      # Core DCA vault (create/execute/cancel plans)
│   └── bitflow-sbtc-swap-router.clar  # STX → sBTC swap via Bitflow
├── keeper-bot/             # Automated DCA executor
│   └── src/                # Bot logic (scan plans, build & broadcast txs)
└── .github/workflows/      # GitHub Actions (keeper-bot cron every 10min)
```

## Features

- **DCA Vault** - Create automated recurring buy plans (STX → sBTC) with configurable intervals and amounts. Pause, resume, or cancel anytime with refund.
- **Swap** - Instant token swaps via Bitflow DEX with real-time quotes.
- **Portfolio Tracker** - Real-time balances, PnL tracking, portfolio health score, stacking & sBTC monitoring.
- **Price Alerts** - Set target prices and get notified via toast/drawer notifications.
- **Market Intelligence** - Fear & Greed Index, trending tokens, live crypto news, STX market stats.
- **Keeper Bot** - Serverless bot (GitHub Actions) that automatically executes DCA plans when they're due.

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
| Deployment | Vercel (frontend), GitHub Actions (keeper bot) |

## Smart Contracts

Deployed on **Stacks Mainnet** at `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV`:

| Contract | Description |
|----------|-------------|
| `dca-vault` | Core vault - manages DCA plans, deposits, execution, fees (0.3%) |
| `bitflow-sbtc-swap-router` | Routes STX → sBTC swaps through Bitflow's xyk pool |

Key parameters:
- Min deposit: 2 STX | Min swap: 1 STX
- Max plans per user: 10
- Protocol fee: 0.3% per swap

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

### Keeper Bot

```bash
cd keeper-bot
cp .env.example .env   # Fill in KEEPER_PRIVATE_KEY and KEEPER_ADDRESS
npm install
npm run dev
```

`KEEPER_PRIVATE_KEY` accepts either a 64-char hex private key or a 24-word mnemonic seed phrase.

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

### Keeper Bot

| Variable | Required | Description |
|----------|----------|-------------|
| `KEEPER_PRIVATE_KEY` | Yes | Hex key or 24-word mnemonic |
| `KEEPER_ADDRESS` | Yes | Keeper wallet STX address |
| `CONTRACT_ADDRESS` | No | DCA vault address (default: mainnet) |
| `HIRO_API_URL` | No | Stacks API (default: https://api.hiro.so) |
| `MIN_AMOUNT_OUT` | No | Min output for slippage (default: 0) |

## Deployment

- **Frontend**: Push to `main` → auto-deploys on Vercel
- **Keeper Bot**: Runs via GitHub Actions cron (`*/10 * * * *`). Requires `KEEPER_PRIVATE_KEY` and `KEEPER_ADDRESS` as repository secrets.

## License

MIT
