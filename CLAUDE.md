# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend
```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # Run ESLint
npm run test:e2e     # Run all Playwright tests (desktop + mobile)
npm run test:e2e:ui  # Run tests with Playwright UI for debugging
```

Run a single Playwright test file:
```bash
npx playwright test e2e/dca.spec.ts
npx playwright test e2e/dca.spec.ts --project=chromium
```

### Keeper Bot
```bash
cd keeper-bot && npm run dev   # Run bot in watch mode
cd keeper-bot && npm run build # Compile TypeScript
```

### Smart Contracts
```bash
cd contracts && clarinet check  # Validate Clarity contracts
cd contracts && clarinet test   # Run contract unit tests
```

## Architecture

StacksPort is a non-custodial DCA (Dollar-Cost Averaging) and portfolio management platform on the Stacks blockchain. Users can automate recurring STX→sBTC and sBTC→USDCx swaps via Bitflow DEX.

### Key Directories

- **`src/app/`** — Next.js 15 App Router pages and API routes
  - `dashboard/` — Portfolio overview, market stats, news
  - `trade/` — Swap widget and aeUSDC migration
  - `dca/` — DCA vault management (the primary feature)
  - `assets/` — Holdings, PnL, stacking tracker
  - `notifications/` — Alerts and notification history
  - `ai/` — Stacks AI insights (Groq-powered)
  - `api/` — Server-side proxy routes for Bitflow, CoinGecko, news
- **`src/components/`** — Feature-organized React components (ui/, trade/, dca/, assets/)
- **`src/store/`** — Four Zustand stores: `walletStore`, `notificationStore`, `priceAlertStore`, `themeStore`
- **`src/hooks/`** — Custom hooks with SWR for data fetching (`useMarketData`, `useWalletSync`, etc.)
- **`src/lib/`** — Core utilities: `stacks.ts` (blockchain), `bitflow-server.ts` (DEX), `dca.ts` / `dca-sbtc.ts` (vault logic)
- **`contracts/`** — Clarity 3 smart contracts (deployed on Stacks Mainnet)
- **`keeper-bot/`** — Node.js bot that auto-executes DCA plans on a schedule
- **`e2e/`** — Playwright tests across 3 browser profiles (desktop, iPhone 14, Pixel 7)

### State Management

All global state lives in Zustand stores — no Redux, no React Context. Each store exports a single hook with state + actions. Components read directly from stores via hooks.

### Blockchain Integration

- **`@stacks/transactions`** — Contract calls, transaction building
- **`@stacks/connect`** / **`@stacks/connect-ui`** — Wallet connection (Leather, Xverse)
- **`@bitflowlabs/core-sdk`** — Swap quotes and routing via Bitflow DEX
- Contract address: `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV` (mainnet)

### Smart Contract Constraints
- Min swap: 1 STX / 334 sats sBTC
- Max plans per user: 10
- Min initial deposit: 2 STX / 668 sats

### API Routes (Next.js)

API routes in `src/app/api/` act as server-side proxies to avoid CORS and hide API keys. Direct blockchain calls happen client-side via Stacks SDK.

### Animations

GSAP is used for complex timeline animations (hero sections). Framer Motion handles component-level transitions. `src/lib/gsap.ts` and `src/lib/animations.ts` are the entry points.

### Testing

E2E tests use Playwright with a mock wallet fixture in `e2e/fixtures/test-utils.ts`. Tests run against three browser profiles. Expected baseline: ~84 tests passing on desktop, ~78 on mobile.

### Environment Variables

Frontend (`.env.local`):
- `GROQ_API_KEY` — AI insights
- `NEXT_PUBLIC_CONTRACT_ADDRESS` — DCA vault contract
- `BITFLOW_API_KEY` — Optional Bitflow API key

Keeper bot (`keeper-bot/.env`):
- `KEEPER_PRIVATE_KEY`, `KEEPER_ADDRESS` — Bot wallet credentials
- `CONTRACT_ADDRESS`, `HIRO_API_URL` — Contract and RPC config
